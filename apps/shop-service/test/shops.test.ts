import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES } from "@markethub/shared";
import { OWNER_ID, PNG, sampleShop, setup, validShopFields } from "./helpers";

const UPLOAD_DIR = process.env.UPLOAD_DIR!;
let ctx: Awaited<ReturnType<typeof setup>>;
let owner: string;

beforeEach(async () => {
  ctx = await setup();
  owner = await ctx.cookie(OWNER_ID, "empresario");
});

const square = [[-3.8, 40.3], [-3.6, 40.3], [-3.6, 40.5], [-3.8, 40.5], [-3.8, 40.3]];

describe("GET /api/shop-types", () => {
  it("is public and lists the types from the DB", async () => {
    const res = await request(ctx.app).get("/api/shop-types").expect(200);
    expect(res.body).toEqual({ shopTypes: [{ id: 1, name: "Panadería y pastelería" }] });
  });
});

const shops = (n: number, from = 1) => Array.from({ length: n }, (_, i) => sampleShop({ id: from + i }));

describe("GET /api/shops", () => {
  it("returns the first page of a postal code + name search, without a session", async () => {
    ctx.repo.searchShopsPage.mockResolvedValue({ shops: shops(10), total: 23 });
    const res = await request(ctx.app).get("/api/shops").query({ postalCode: "28001", q: "luna" }).expect(200);

    expect(ctx.repo.searchShopsPage).toHaveBeenCalledWith({ postalCode: "28001", q: "luna" }, { offset: 0, limit: 10 });
    expect(res.body).toMatchObject({ total: 23, nextOffset: 10 });
    expect(res.body.shops).toHaveLength(10);
  });

  it("returns a later page from its offset", async () => {
    ctx.repo.searchShopsPage.mockResolvedValue({ shops: shops(10, 11), total: 23 });
    const res = await request(ctx.app).get("/api/shops").query({ q: "luna", offset: "10" }).expect(200);

    expect(ctx.repo.searchShopsPage).toHaveBeenCalledWith({ q: "luna" }, { offset: 10, limit: 10 });
    expect(res.body.nextOffset).toBe(20);
  });

  it.each([
    ["the last page", { shops: shops(3, 21), total: 23 }, "20"],
    ["a single short page", { shops: shops(4), total: 4 }, "0"],
    ["no results", { shops: [], total: 0 }, "0"],
  ])("has no next page after %s", async (_label, page, offset) => {
    ctx.repo.searchShopsPage.mockResolvedValue(page);
    const res = await request(ctx.app).get("/api/shops").query({ q: "luna", offset }).expect(200);
    expect(res.body.nextOffset).toBeNull();
  });

  it("requires a postal code or a name", async () => {
    const res = await request(ctx.app).get("/api/shops").expect(400);
    expect(res.body.error).toBe("Indica un código postal o un nombre");
    expect(ctx.repo.searchShopsPage).not.toHaveBeenCalled();
  });

  it("rejects a non-Spanish postal code", async () => {
    const res = await request(ctx.app).get("/api/shops").query({ postalCode: "99999" }).expect(400);
    expect(res.body.error).toMatch(/código postal/);
    expect(ctx.repo.searchShopsPage).not.toHaveBeenCalled();
  });

  it.each(["-1", "2.5", "abc", "10001"])("rejects the offset %s", async (offset) => {
    await request(ctx.app).get("/api/shops").query({ q: "luna", offset }).expect(400, { error: "Página no válida" });
    expect(ctx.repo.searchShopsPage).not.toHaveBeenCalled();
  });
});

describe("POST /api/shops/search-area", () => {
  const area = { type: "Polygon", coordinates: [square] };

  it("returns a page of the shops inside the polygon", async () => {
    ctx.repo.searchShopsPage.mockResolvedValue({ shops: shops(10), total: 12 });

    const res = await request(ctx.app).post("/api/shops/search-area").send({ area, q: "pan" }).expect(200);

    expect(ctx.repo.searchShopsPage).toHaveBeenCalledWith({ area, q: "pan" }, { offset: 0, limit: 10 });
    expect(Object.keys(res.body).sort()).toEqual(["nextOffset", "shops", "total"]);
    expect(res.body).toMatchObject({ total: 12, nextOffset: 10 });
  });

  it("takes the offset from the body", async () => {
    ctx.repo.searchShopsPage.mockResolvedValue({ shops: shops(2, 11), total: 12 });
    const res = await request(ctx.app).post("/api/shops/search-area").send({ area, offset: 10 }).expect(200);
    expect(ctx.repo.searchShopsPage).toHaveBeenCalledWith({ area, q: undefined }, { offset: 10, limit: 10 });
    expect(res.body.nextOffset).toBeNull();
  });

  it("explains a bad offset as such, not as a bad area", async () => {
    await request(ctx.app).post("/api/shops/search-area").send({ area, offset: -1 }).expect(400, { error: "Página no válida" });
    expect(ctx.repo.searchShopsPage).not.toHaveBeenCalled();
  });

  it.each([
    ["a point", { type: "Point", coordinates: [-3.7, 40.4] }],
    ["an unclosed ring", { type: "Polygon", coordinates: [square.slice(0, 3)] }],
    ["out-of-range coordinates", { type: "Polygon", coordinates: [square.map(([x, y]) => [x! * 100, y])] }],
  ])("rejects %s with a Spanish message", async (_label, area) => {
    const res = await request(ctx.app).post("/api/shops/search-area").send({ area }).expect(400);
    expect(res.body.error).toBe("La zona seleccionada en el mapa no es válida");
  });
});

describe("GET /api/shops/:id", () => {
  it("returns the shop with its products", async () => {
    ctx.repo.getShop.mockResolvedValue(sampleShop());
    const res = await request(ctx.app).get("/api/shops/1").expect(200);
    expect(res.body.name).toBe("Panadería Luna");
    expect(ctx.repo.getShop).toHaveBeenCalledWith(1);
  });

  it("returns 404 when it doesn't exist", async () => {
    await request(ctx.app).get("/api/shops/99").expect(404, { error: "Tienda no encontrada" });
  });

  it.each(["abc", "0", "-1", "1.5"])("rejects the id %s", async (id) => {
    await request(ctx.app).get(`/api/shops/${id}`).expect(400);
    expect(ctx.repo.getShop).not.toHaveBeenCalled();
  });
});

describe("POST /api/shops", () => {
  const create = (cookie = owner) => {
    const req = request(ctx.app).post("/api/shops").set("Cookie", cookie);
    for (const [k, v] of Object.entries(validShopFields)) req.field(k, v);
    return req;
  };

  it("saves the image and creates the shop for the current user", async () => {
    ctx.repo.getShop.mockResolvedValue(sampleShop());
    await create().attach("image", PNG, { filename: "tienda.png", contentType: "image/png" }).expect(201);

    const [ownerId, input, imageUrl] = ctx.repo.createShop.mock.calls[0]!;
    expect(ownerId).toBe(OWNER_ID);
    expect(input).toEqual({ ...validShopFields, shopTypeId: 1, lat: 40.42, lng: -3.7 });
    expect(imageUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(await readFile(path.join(UPLOAD_DIR, path.basename(imageUrl)))).toEqual(PNG);
  });

  it("requires an image", async () => {
    const res = await create().expect(400);
    expect(res.body.error).toBe("La imagen de la tienda es obligatoria");
  });

  it("only accepts JPG, PNG or WEBP", async () => {
    const res = await create().attach("image", Buffer.from("GIF89a"), { filename: "a.gif", contentType: "image/gif" }).expect(400);
    expect(res.body.error).toBe("La imagen debe ser JPG, PNG o WEBP");
  });

  it("rejects images over 5 MB", async () => {
    const big = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    const res = await create().attach("image", big, { filename: "big.png", contentType: "image/png" }).expect(400);
    expect(res.body.error).toBe("La imagen no puede superar los 5 MB");
  });

  it("rejects an unknown shop type without storing the image", async () => {
    ctx.repo.shopTypeExists.mockResolvedValue(false);
    const before = await readdir(UPLOAD_DIR);
    const res = await create().attach("image", PNG, { filename: "a.png", contentType: "image/png" }).expect(400);
    expect(res.body.error).toBe("El tipo de tienda no existe");
    expect(await readdir(UPLOAD_DIR)).toEqual(before);
  });

  it("rejects a location outside Spain", async () => {
    const res = await request(ctx.app)
      .post("/api/shops")
      .set("Cookie", owner)
      .field({ ...validShopFields, lat: "48.85", lng: "2.35" })
      .attach("image", PNG, { filename: "a.png", contentType: "image/png" })
      .expect(400);
    expect(res.body.error).toBe("Ubicación fuera de España");
  });

  it("is only for empresarios", async () => {
    await create(await ctx.cookie(1, "cliente")).expect(403);
    expect(ctx.repo.createShop).not.toHaveBeenCalled();
  });
});

describe("PUT /api/shops/:id", () => {
  const update = (cookie = owner) =>
    request(ctx.app).put("/api/shops/1").set("Cookie", cookie).field(validShopFields);

  it("updates without changing the image when none is sent", async () => {
    ctx.repo.getShopOwner.mockResolvedValue({ ownerId: OWNER_ID, imageUrl: "/uploads/old.png" });
    ctx.repo.getShop.mockResolvedValue(sampleShop());
    await update().expect(200);
    expect(ctx.repo.updateShop).toHaveBeenCalledWith(1, expect.objectContaining({ name: "Panadería Luna" }), undefined);
  });

  it("replaces the image and deletes the old file", async () => {
    await writeFile(path.join(UPLOAD_DIR, "old.png"), PNG);
    ctx.repo.getShopOwner.mockResolvedValue({ ownerId: OWNER_ID, imageUrl: "/uploads/old.png" });
    ctx.repo.getShop.mockResolvedValue(sampleShop());

    await update().attach("image", PNG, { filename: "new.png", contentType: "image/png" }).expect(200);

    const newUrl: string = ctx.repo.updateShop.mock.calls[0]![2];
    const files = await readdir(UPLOAD_DIR);
    expect(files).not.toContain("old.png");
    expect(files).toContain(path.basename(newUrl));
  });

  it("returns 403 for another empresario's shop", async () => {
    ctx.repo.getShopOwner.mockResolvedValue({ ownerId: 999, imageUrl: "/uploads/x.png" });
    const res = await update().expect(403);
    expect(res.body.error).toBe("Esta tienda no es tuya");
    expect(ctx.repo.updateShop).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing shop", async () => {
    await update().expect(404);
  });
});

describe("DELETE /api/shops/:id", () => {
  it("deletes the shop and every image it had", async () => {
    await writeFile(path.join(UPLOAD_DIR, "s.png"), PNG);
    await writeFile(path.join(UPLOAD_DIR, "p.png"), PNG);
    ctx.repo.getShopOwner.mockResolvedValue({ ownerId: OWNER_ID, imageUrl: "/uploads/s.png" });
    ctx.repo.deleteShop.mockResolvedValue(["/uploads/s.png", "/uploads/p.png"]);

    await request(ctx.app).delete("/api/shops/1").set("Cookie", owner).expect(204);

    expect(ctx.repo.deleteShop).toHaveBeenCalledWith(1);
    const files = await readdir(UPLOAD_DIR);
    expect(files).not.toContain("s.png");
    expect(files).not.toContain("p.png");
  });

  it("returns 403 for another empresario's shop", async () => {
    ctx.repo.getShopOwner.mockResolvedValue({ ownerId: 999, imageUrl: "/uploads/x.png" });
    await request(ctx.app).delete("/api/shops/1").set("Cookie", owner).expect(403);
    expect(ctx.repo.deleteShop).not.toHaveBeenCalled();
  });
});
