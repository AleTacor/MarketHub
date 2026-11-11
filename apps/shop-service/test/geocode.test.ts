import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGeocoder, houseNumberIn, postalCodeIn } from "../src/geocoder";
import { OWNER_ID, setup } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
let owner: string;

beforeEach(async () => {
  ctx = await setup();
  owner = await ctx.cookie(OWNER_ID, "empresario");
});

const result = { label: "Calle Mayor, 1, Madrid", lat: 40.4153, lng: -3.7074, postalCode: "28013", exact: true };

describe("GET /api/geocode", () => {
  it("returns the geocoder's matches for the trimmed address", async () => {
    ctx.geocoder.search.mockResolvedValue([result]);
    const res = await request(ctx.app).get("/api/geocode").query({ q: "  Calle Mayor 1, Madrid " }).set("Cookie", owner).expect(200);
    expect(ctx.geocoder.search).toHaveBeenCalledWith("Calle Mayor 1, Madrid");
    expect(res.body).toEqual({ results: [result] });
  });

  it.each([
    [{}, "Escribe una dirección"],
    [{ q: "ab" }, "Escribe una dirección más completa"],
    [{ q: "x".repeat(201) }, "La dirección no puede superar los 200 caracteres"],
  ])("rejects %o with a Spanish message", async (query, message) => {
    await request(ctx.app).get("/api/geocode").query(query).set("Cookie", owner).expect(400, { error: message });
    expect(ctx.geocoder.search).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    await request(ctx.app).get("/api/geocode").query({ q: "Calle Mayor" }).expect(401);
    expect(ctx.geocoder.search).not.toHaveBeenCalled();
  });

  it("is only for empresarios", async () => {
    const cliente = await ctx.cookie(3, "cliente");
    await request(ctx.app).get("/api/geocode").query({ q: "Calle Mayor" }).set("Cookie", cliente).expect(403);
    expect(ctx.geocoder.search).not.toHaveBeenCalled();
  });
});

describe("query parsing", () => {
  it.each([
    ["Av. del Papa Negro, 22, Hortaleza, 28043 Madrid", "22", "28043"],
    ["Calle 2 de Mayo, 5, 28004 Madrid", "5", "28004"],
    ["Calle Mayor 3, 2º B, Alcalá de Henares", "3", null],
    ["Avenida de los Andes, Madrid", null, null],
    ["Calle Falsa 1, 99999", "1", null], // not a valid Spanish postal code
  ])("%s → number %s, postal code %s", (query, number, postalCode) => {
    expect(houseNumberIn(query)).toBe(number);
    expect(postalCodeIn(query)).toBe(postalCode);
  });
});

describe("createGeocoder", () => {
  const NOMINATIM = "https://nominatim.test/search";
  const CARTO = "https://carto.test/candidates";

  /** Fake fetch answering per service; records the queries. */
  function services({ nominatim, carto = [] }: { nominatim: unknown; carto?: unknown | (() => Promise<Response>) }) {
    const fetchFn = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.startsWith(NOMINATIM)) return Response.json(nominatim);
      if (typeof carto === "function") return (carto as () => Promise<Response>)();
      return Response.json(carto);
    });
    const queries = (base: string) =>
      fetchFn.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith(base)).map((u) => new URL(u).searchParams.get("q"));
    const geocoder = createGeocoder({ nominatimUrl: NOMINATIM, cartoCiudadUrl: CARTO, userAgent: "MarketHub/test", fetchFn, minIntervalMs: 0 });
    return { geocoder, fetchFn, nominatimQueries: () => queries(NOMINATIM), cartoQueries: () => queries(CARTO) };
  }

  // Shaped like Nominatim's real answers.
  const papaNegroStreet = {
    lat: "40.4532335",
    lon: "-3.6311812",
    display_name: "Avenida del Papa Negro, Piovera, Hortaleza, Madrid, Comunidad de Madrid, 20043, España",
    // A street, no house number, and OSM's wrong postal code for it.
    address: { road: "Avenida del Papa Negro", suburb: "Hortaleza", city: "Madrid", postcode: "20043" },
  };
  const andesDoor = (business: Record<string, string>, lat: string) => ({
    lat,
    lon: "-3.6178172",
    display_name: `${Object.values(business)[0]}, 50, Avenida de los Andes, Palomas, Hortaleza, Madrid, Comunidad de Madrid, 28042, España`,
    address: { ...business, house_number: "50", road: "Avenida de los Andes", city: "Madrid", postcode: "28042" },
  });
  // Shaped like CartoCiudad's real candidates.
  const portal = (portalNumber: number, muni = "Madrid", lat = 40.457717190755076, lng = -3.6237832220032598) => ({
    type: "portal",
    address: `AVENIDA PAPA NEGRO ${portalNumber}, ${muni}`,
    muni,
    portalNumber,
    postalCode: "28043",
    lat,
    lng,
  });

  it("asks Nominatim for Spain only, in Spanish, with the User-Agent", async () => {
    const { geocoder, fetchFn, nominatimQueries } = services({ nominatim: [] });
    await geocoder.search("Calle Mayor 1");
    const [url, init] = fetchFn.mock.calls[0]!;
    const params = new URL(String(url)).searchParams;
    expect(nominatimQueries()).toEqual(["Calle Mayor 1"]);
    expect(params.get("countrycodes")).toBe("es");
    expect(params.get("accept-language")).toBe("es");
    expect((init!.headers as Record<string, string>)["User-Agent"]).toBe("MarketHub/test");
  });

  it("finds the exact door in CartoCiudad when OSM only knows the street", async () => {
    const { geocoder, cartoQueries } = services({ nominatim: [papaNegroStreet], carto: [portal(20), portal(22), portal(21)] });

    const results = await geocoder.search("Av. del Papa Negro, 22, Hortaleza, 28043 Madrid");

    // CartoCiudad gets the clean street + number + town, not the free text it misreads.
    expect(cartoQueries()).toEqual(["Avenida del Papa Negro 22, Madrid"]);
    expect(results).toEqual([
      { label: "Avenida del Papa Negro, 22, 28043 Madrid", lat: 40.457717, lng: -3.623783, postalCode: "28043", exact: true },
    ]);
  });

  it("only trusts a CartoCiudad door with the same number and town", async () => {
    const { geocoder } = services({ nominatim: [papaNegroStreet], carto: [portal(12), portal(22, "Mula")] });
    const [r] = await geocoder.search("Avenida del Papa Negro 22, Madrid");
    expect(r).toMatchObject({ exact: false, lat: 40.453234, lng: -3.631181 });
  });

  it("marks a street-level match as approximate, without its unreliable postal code or a number", async () => {
    const { geocoder } = services({ nominatim: [papaNegroStreet], carto: "" });
    expect(await geocoder.search("Avenida del Papa Negro 22, Madrid")).toEqual([
      { label: "Avenida del Papa Negro, Madrid", lat: 40.453234, lng: -3.631181, postalCode: null, exact: false },
    ]);
  });

  it("prefers the postal code the owner typed", async () => {
    const { geocoder } = services({ nominatim: [papaNegroStreet], carto: "" });
    const [r] = await geocoder.search("Avenida del Papa Negro 22, 28043 Madrid");
    expect(r).toMatchObject({ postalCode: "28043", label: "Avenida del Papa Negro, 28043 Madrid", exact: false });
  });

  it("falls back to the street if CartoCiudad fails (it only refines)", async () => {
    const { geocoder } = services({ nominatim: [papaNegroStreet], carto: async () => new Response("down", { status: 500 }) });
    const [r] = await geocoder.search("Avenida del Papa Negro 22, Madrid");
    expect(r).toMatchObject({ exact: false });
  });

  it("keeps OSM's door when it has the typed number, labels it by address and merges duplicates", async () => {
    const { geocoder, cartoQueries } = services({
      nominatim: [andesDoor({ shop: "Hipercor" }, "40.4563958"), andesDoor({ amenity: "Oficina de Correos" }, "40.4566392")],
    });
    expect(await geocoder.search("Avda. de los Andes, 50, 28042 Madrid")).toEqual([
      { label: "Avenida de los Andes, 50, 28042 Madrid", lat: 40.456396, lng: -3.617817, postalCode: "28042", exact: true },
    ]);
    expect(cartoQueries()).toEqual([]);
  });

  it("uses the town when there is no city, and the full name when there is no street", async () => {
    const { geocoder } = services({
      nominatim: [
        { lat: "40.5", lon: "-3.3", display_name: "x", address: { road: "Calle Mayor", house_number: "3", postcode: "28801", town: "Alcalá de Henares" } },
        { lat: "40.6", lon: "-3.4", display_name: "Torrelaguna, Comunidad de Madrid, España", address: { village: "Torrelaguna" } },
      ],
    });
    expect((await geocoder.search("Calle Mayor 3")).map((r) => [r.label, r.exact])).toEqual([
      ["Calle Mayor, 3, 28801 Alcalá de Henares", true],
      ["Torrelaguna, Comunidad de Madrid, España", false],
    ]);
  });

  it.each([
    ["Nominatim answers with an error", async () => new Response("busy", { status: 503 })],
    ["the network fails", async () => Promise.reject(new TypeError("fetch failed"))],
  ])("reports a 502 in Spanish when %s", async (_label, impl) => {
    const geocoder = createGeocoder({ nominatimUrl: NOMINATIM, cartoCiudadUrl: CARTO, userAgent: "t", fetchFn: vi.fn<typeof fetch>(impl), minIntervalMs: 0 });
    await expect(geocoder.search("Calle Mayor")).rejects.toMatchObject({
      status: 502,
      message: "No se pudo buscar la dirección. Inténtalo de nuevo o marca la ubicación en el mapa",
    });
  });

  it("spaces out Nominatim requests to respect its rate limit", async () => {
    const times: number[] = [];
    const fetchFn = vi.fn<typeof fetch>(async () => {
      times.push(Date.now());
      return Response.json([]);
    });
    const geocoder = createGeocoder({ nominatimUrl: NOMINATIM, cartoCiudadUrl: CARTO, userAgent: "t", fetchFn, minIntervalMs: 100 });

    await Promise.all([geocoder.search("a"), geocoder.search("b")]);
    expect(times[1]! - times[0]!).toBeGreaterThanOrEqual(95);
  });
});
