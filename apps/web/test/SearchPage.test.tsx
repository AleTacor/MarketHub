import { act, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeoPolygon, ShopSearchPage, ShopSummary } from "@markethub/shared";
import SearchPage from "@/app/page";
import { recorder, server } from "./msw";
import { SAVED_SEARCH_STORAGE_KEY } from "@/lib/savedSearch";
import { renderWithClient, shop } from "./render";

const AREA: GeoPolygon = {
  type: "Polygon",
  coordinates: [[[-3.8, 40.3], [-3.6, 40.3], [-3.6, 40.5], [-3.8, 40.5], [-3.8, 40.3]]],
};

// Leaflet can't run in jsdom. This fake exposes the same props as buttons/attributes.
vi.mock("@/components/maps", () => ({
  AreaSelectMap: (props: {
    shops: unknown[];
    onAreaChange: (a: GeoPolygon | null) => void;
    clearKey: number;
    restoredArea?: GeoPolygon | null;
    fitToShops: boolean;
  }) => (
    <div
      data-testid="map"
      data-shops={props.shops.length}
      data-clear-key={props.clearKey}
      data-fit={String(props.fitToShops)}
      data-restored-area={props.restoredArea ? JSON.stringify(props.restoredArea) : ""}
    >
      <button onClick={() => props.onAreaChange(AREA)}>Dibujar zona</button>
      <button onClick={() => props.onAreaChange(null)}>Borrar zona</button>
    </div>
  ),
}));

/** A one-page search response. */
const page = (shops: ShopSummary[], total = shops.length, nextOffset: number | null = null): ShopSearchPage => ({ shops, total, nextOffset });

let listCalls: ReturnType<typeof recorder>;
let areaCalls: ReturnType<typeof recorder>;

const luna = shop({ id: 1, name: "Panadería Luna", postalCode: "28001" });
const sol = shop({ id: 2, name: "Frutería Sol", postalCode: "28013", description: "" });

beforeEach(() => {
  listCalls = recorder();
  areaCalls = recorder();
  server.use(
    http.get("/api/shops", async ({ request }) => {
      await listCalls.record(request);
      return HttpResponse.json(page([luna, sol]));
    }),
    http.post("/api/shops/search-area", async ({ request }) => {
      await areaCalls.record(request);
      return HttpResponse.json(page([luna, sol]));
    }),
    http.get("/api/shop-types", () =>
      HttpResponse.json({ shopTypes: [{ id: 1, name: "Panadería y pastelería" }, { id: 2, name: "Frutería" }] }),
    ),
  );
});

const cpInput = () => screen.getByLabelText("Código postal");
/** Waits until the result list shows `n` shops. */
const expectResults = (n: number) =>
  waitFor(() => expect(within(screen.getByRole("list", { name: "Tiendas encontradas" })).getAllByRole("link")).toHaveLength(n));
const nameInput = () => screen.getByLabelText("Nombre de la tienda");
const searchButton = () => screen.getByRole("button", { name: "Buscar" });
const map = () => screen.getByTestId("map");

describe("search page", () => {
  it("starts empty and doesn't call the API", () => {
    renderWithClient(<SearchPage />);
    expect(screen.getByText("Aún no has buscado nada.")).toBeInTheDocument();
    expect(listCalls.calls).toHaveLength(0);
    expect(areaCalls.calls).toHaveLength(0);
  });

  it("searches by postal code and lists the shops", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.type(cpInput(), "28001");
    await user.click(searchButton());

    await expectResults(2);
    expect(listCalls.calls[0]!.url.searchParams.get("postalCode")).toBe("28001");
    expect(listCalls.calls[0]!.url.searchParams.has("q")).toBe(false);

    const card = screen.getByRole("link", { name: /Panadería Luna/ });
    expect(card).toHaveAttribute("href", "/tiendas/1");
    expect(within(card).getByText("Pan de masa madre")).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: "Panadería Luna" })).toHaveAttribute("src", "/uploads/luna.png");
    expect(within(screen.getByRole("link", { name: /Frutería Sol/ })).getByText("Sin descripción")).toBeInTheDocument();
  });

  it("only accepts digits in the postal code field", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.type(cpInput(), "28a0-01");
    expect(cpInput()).toHaveValue("28001");
  });

  it("combines postal code and name", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.type(cpInput(), "28001");
    await user.type(nameInput(), "luna");
    await user.click(searchButton());

    await waitFor(() => expect(listCalls.calls).toHaveLength(1));
    const params = listCalls.calls[0]!.url.searchParams;
    expect(params.get("postalCode")).toBe("28001");
    expect(params.get("q")).toBe("luna");
  });

  it("searches by name only", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.type(nameInput(), "sol");
    await user.click(searchButton());

    await waitFor(() => expect(listCalls.calls).toHaveLength(1));
    expect(listCalls.calls[0]!.url.searchParams.get("q")).toBe("sol");
    expect(listCalls.calls[0]!.url.searchParams.has("postalCode")).toBe(false);
  });

  it("rejects an invalid postal code without calling the API", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.type(cpInput(), "99999");
    await user.click(searchButton());

    expect(screen.getByText(/Introduce un código postal español válido/)).toBeInTheDocument();
    expect(listCalls.calls).toHaveLength(0);
  });

  it("asks for something to search when the form is empty", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.click(searchButton());
    expect(screen.getByText("Introduce un código postal, un nombre o dibuja una zona en el mapa")).toBeInTheDocument();
  });

  it("lists the results in their own scrollable list", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.click(screen.getByRole("button", { name: "Dibujar zona" }));

    const list = await screen.findByRole("list", { name: "Tiendas encontradas" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(list).toHaveClass("overflow-y-auto");
  });

  it("shows each shop's type but not its postal code", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.click(screen.getByRole("button", { name: "Dibujar zona" }));

    const card = await screen.findByRole("link", { name: /Panadería Luna/ });
    expect(card).toHaveTextContent("Panadería y pastelería");
    expect(card).not.toHaveTextContent("28001");
  });

  it("searches the drawn area by location", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.type(cpInput(), "28001");
    await user.type(nameInput(), "pan");

    await user.click(screen.getByRole("button", { name: "Dibujar zona" }));

    await expectResults(2);
    expect(areaCalls.calls[0]!.body).toEqual({ area: AREA, q: "pan" });
    expect(cpInput()).toHaveValue(""); // the area replaces the postal code
    expect(map()).toHaveAttribute("data-fit", "false"); // don't move the map the user just drew on
    expect(map()).toHaveAttribute("data-shops", "2");
  });

  it("refines an area search by name when submitting the form", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.click(screen.getByRole("button", { name: "Dibujar zona" }));
    await waitFor(() => expect(areaCalls.calls).toHaveLength(1));

    await user.type(nameInput(), "sol");
    await user.click(searchButton());

    await waitFor(() => expect(areaCalls.calls).toHaveLength(2));
    expect(areaCalls.calls[1]!.body).toEqual({ area: AREA, q: "sol" });
    expect(listCalls.calls).toHaveLength(0);
  });

  it("clears the drawn area when searching by postal code", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.click(screen.getByRole("button", { name: "Dibujar zona" }));
    await waitFor(() => expect(areaCalls.calls).toHaveLength(1));
    const clearKeyBefore = map().getAttribute("data-clear-key");

    await user.type(cpInput(), "28013");
    await user.click(searchButton());

    await waitFor(() => expect(listCalls.calls).toHaveLength(1));
    expect(map().getAttribute("data-clear-key")).not.toBe(clearKeyBefore);
    expect(map()).toHaveAttribute("data-fit", "true");
    await expectResults(2);
  });

  it("goes back to the empty state when the area is removed", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.click(screen.getByRole("button", { name: "Dibujar zona" }));
    await expectResults(2);

    await user.click(screen.getByRole("button", { name: "Borrar zona" }));

    expect(screen.getByText("Aún no has buscado nada.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Panadería Luna/ })).not.toBeInTheDocument();
    expect(map()).toHaveAttribute("data-shops", "0");
  });

  it("says so when nothing matches", async () => {
    server.use(http.get("/api/shops", () => HttpResponse.json(page([]))));
    const { user } = renderWithClient(<SearchPage />);
    await user.type(cpInput(), "28001");
    await user.click(searchButton());

    expect(await screen.findByText("No hay tiendas que coincidan con tu búsqueda.")).toBeInTheDocument();
  });

  it("doesn't show how many shops were found", async () => {
    const { user } = renderWithClient(<SearchPage />);
    await user.type(cpInput(), "28001");
    await user.click(searchButton());
    await expectResults(2);
    expect(screen.queryByText(/encontrada/)).not.toBeInTheDocument();
  });

  it("shows the backend error message", async () => {
    server.use(http.get("/api/shops", () => HttpResponse.json({ error: "Error interno del servidor" }, { status: 500 })));
    const { user } = renderWithClient(<SearchPage />);
    await user.type(cpInput(), "28001");
    await user.click(searchButton());
    expect(await screen.findByText("Error interno del servidor")).toBeInTheDocument();
  });

  describe("type filter", () => {
    const typeSelect = () => screen.getByLabelText("Tipo de tienda");
    const chooseType = async (user: ReturnType<typeof renderWithClient>["user"], name: string) =>
      user.selectOptions(typeSelect(), await screen.findByRole("option", { name }));

    it("offers every type from the API, and all of them by default", async () => {
      renderWithClient(<SearchPage />);
      expect(await screen.findByRole("option", { name: "Frutería" })).toBeInTheDocument();
      expect(typeSelect()).toHaveValue("");
      // "Todos los tipos" first, then the types in the API's order (sorted there).
      expect(within(typeSelect()).getAllByRole("option").map((o) => o.textContent)).toEqual([
        "Todos los tipos",
        "Panadería y pastelería",
        "Frutería",
      ]);
    });

    it("narrows a postal code search to the chosen type", async () => {
      const { user } = renderWithClient(<SearchPage />);
      await user.type(cpInput(), "28001");
      await chooseType(user, "Frutería");
      expect(listCalls.calls).toHaveLength(0); // not a search on its own
      await user.click(searchButton());

      await waitFor(() => expect(listCalls.calls).toHaveLength(1));
      expect(listCalls.calls[0]!.url.searchParams.get("shopTypeId")).toBe("2");
      expect(listCalls.calls[0]!.url.searchParams.get("postalCode")).toBe("28001");
    });

    it("re-runs the current search at once when the type changes", async () => {
      const { user } = renderWithClient(<SearchPage />);
      await user.click(screen.getByRole("button", { name: "Dibujar zona" }));
      await waitFor(() => expect(areaCalls.calls).toHaveLength(1));
      expect(areaCalls.calls[0]!.body).toEqual({ area: AREA });

      await chooseType(user, "Panadería y pastelería");
      await waitFor(() => expect(areaCalls.calls).toHaveLength(2));
      expect(areaCalls.calls[1]!.body).toEqual({ area: AREA, shopTypeId: 1 });

    });

    it("stops filtering with Todos los tipos", async () => {
      const { user } = renderWithClient(<SearchPage />);
      await chooseType(user, "Frutería");
      await user.click(screen.getByRole("button", { name: "Dibujar zona" }));
      await waitFor(() => expect(areaCalls.calls).toHaveLength(1));

      await chooseType(user, "Todos los tipos");
      await waitFor(() => expect(areaCalls.calls).toHaveLength(2));
      expect(areaCalls.calls[1]!.body).toEqual({ area: AREA });
    });

    it("applies to an area drawn after choosing it", async () => {
      const { user } = renderWithClient(<SearchPage />);
      await chooseType(user, "Frutería");
      await user.click(screen.getByRole("button", { name: "Dibujar zona" }));

      await waitFor(() => expect(areaCalls.calls).toHaveLength(1));
      expect(areaCalls.calls[0]!.body).toEqual({ area: AREA, shopTypeId: 2 });
    });

    it("is not enough to search", async () => {
      const { user } = renderWithClient(<SearchPage />);
      await chooseType(user, "Frutería");
      await user.click(searchButton());
      expect(screen.getByText("Introduce un código postal, un nombre o dibuja una zona en el mapa")).toBeInTheDocument();
    });

    it("isn't saved with the search", async () => {
      const { user } = renderWithClient(<SearchPage />);
      await chooseType(user, "Frutería");
      await user.type(cpInput(), "28001");
      await user.click(searchButton());
      await waitFor(() => expect(listCalls.calls).toHaveLength(1));
      expect(JSON.parse(localStorage.getItem(SAVED_SEARCH_STORAGE_KEY)!)).toEqual({ kind: "postalCode", postalCode: "28001" });
    });
  });

  describe("saved search", () => {
    const saved = () => {
      const raw = localStorage.getItem(SAVED_SEARCH_STORAGE_KEY);
      return raw && JSON.parse(raw);
    };
    const store = (value: unknown) => localStorage.setItem(SAVED_SEARCH_STORAGE_KEY, typeof value === "string" ? value : JSON.stringify(value));

    it("remembers the drawn area, and forgets it when removed", async () => {
      const { user } = renderWithClient(<SearchPage />);
      await user.click(screen.getByRole("button", { name: "Dibujar zona" }));
      expect(saved()).toEqual({ kind: "area", area: AREA });

      await user.click(screen.getByRole("button", { name: "Borrar zona" }));
      expect(saved()).toBeNull();
    });

    it("draws and searches the saved area on load", async () => {
      store({ kind: "area", area: AREA });
      renderWithClient(<SearchPage />);

      await expectResults(2);
      expect(areaCalls.calls[0]!.body).toEqual({ area: AREA });
      expect(JSON.parse(map().getAttribute("data-restored-area")!)).toEqual(AREA);
      expect(map()).toHaveAttribute("data-fit", "false");
    });

    it("remembers a postal code search, replacing the saved area", async () => {
      const { user } = renderWithClient(<SearchPage />);
      await user.click(screen.getByRole("button", { name: "Dibujar zona" }));
      await user.type(cpInput(), "28013");
      await user.click(searchButton());

      await waitFor(() => expect(listCalls.calls).toHaveLength(1));
      expect(saved()).toEqual({ kind: "postalCode", postalCode: "28013" });
    });

    it("fills in and searches the saved postal code on load", async () => {
      store({ kind: "postalCode", postalCode: "28013" });
      renderWithClient(<SearchPage />);

      await expectResults(2);
      expect(cpInput()).toHaveValue("28013");
      expect(new URL(listCalls.calls[0]!.url).searchParams.get("postalCode")).toBe("28013");
      expect(map()).toHaveAttribute("data-fit", "true"); // zoom to the shops found
      expect(map()).toHaveAttribute("data-restored-area", "");
    });

    it("replaces a saved postal code with a drawn area", async () => {
      store({ kind: "postalCode", postalCode: "28013" });
      const { user } = renderWithClient(<SearchPage />);
      await expectResults(2);
      await user.click(screen.getByRole("button", { name: "Dibujar zona" }));

      expect(saved()).toEqual({ kind: "area", area: AREA });
      expect(cpInput()).toHaveValue("");
    });

    it("forgets the saved search on a name-only search", async () => {
      store({ kind: "postalCode", postalCode: "28013" });
      const { user } = renderWithClient(<SearchPage />);
      await expectResults(2);
      await user.clear(cpInput());
      await user.type(nameInput(), "luna");
      await user.click(searchButton());

      await waitFor(() => expect(listCalls.calls).toHaveLength(2));
      expect(saved()).toBeNull();
    });

    it("moves an area saved under the old key to the new one", async () => {
      localStorage.setItem("mh-search-area", JSON.stringify(AREA));
      renderWithClient(<SearchPage />);

      await expectResults(2);
      expect(saved()).toEqual({ kind: "area", area: AREA });
      expect(localStorage.getItem("mh-search-area")).toBeNull();
    });

    it.each([
      ["not JSON", "{oops"],
      ["not a polygon", { kind: "area", area: { type: "Point", coordinates: [-3.7, 40.4] } }],
      ["an invalid postal code", { kind: "postalCode", postalCode: "99999" }],
      ["an unknown kind", { kind: "name", q: "pan" }],
    ])("ignores a saved value that is %s", async (_label, value) => {
      store(value);
      renderWithClient(<SearchPage />);

      expect(screen.getByText("Aún no has buscado nada.")).toBeInTheDocument();
      expect(cpInput()).toHaveValue("");
      expect(map()).toHaveAttribute("data-restored-area", "");
      expect(areaCalls.calls).toHaveLength(0);
      expect(listCalls.calls).toHaveLength(0);
    });
  });

  describe("pagination", () => {
    const many = (n: number, from = 1) => Array.from({ length: n }, (_, i) => shop({ id: from + i, name: `Tienda ${from + i}` }));
    let pageCalls: ReturnType<typeof recorder>;

    /** 23 shops in pages of 10, like the API. */
    beforeEach(() => {
      pageCalls = recorder();
      const all = many(23);
      server.use(
        http.get("/api/shops", async ({ request }) => {
          await pageCalls.record(request);
          const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
          const next = offset + 10;
          return HttpResponse.json(page(all.slice(offset, next), 23, next < 23 ? next : null));
        }),
      );
    });

    /** Stand-in for IntersectionObserver: `scrollToEnd()` makes the observed element visible. */
    function fakeIntersectionObserver() {
      const observers = new Set<{ cb: IntersectionObserverCallback; targets: Element[] }>();
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          private entry: { cb: IntersectionObserverCallback; targets: Element[] };
          constructor(cb: IntersectionObserverCallback) {
            this.entry = { cb, targets: [] };
            observers.add(this.entry);
          }
          observe(el: Element) {
            this.entry.targets.push(el);
          }
          disconnect() {
            observers.delete(this.entry);
          }
          unobserve() {}
          takeRecords() {
            return [];
          }
        },
      );
      return {
        scrollToEnd: () =>
          act(() => {
            for (const o of [...observers]) {
              o.cb(o.targets.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry), {} as IntersectionObserver);
            }
          }),
      };
    }

    afterEach(() => vi.unstubAllGlobals());

    const offsets = () => pageCalls.calls.map((c) => new URL(c.url).searchParams.get("offset"));
    const cards = () => within(screen.getByRole("list", { name: "Tiendas encontradas" })).getAllByRole("link");

    async function searchByName(user: ReturnType<typeof renderWithClient>["user"]) {
      await user.type(nameInput(), "tienda");
      await user.click(searchButton());
      await expectResults(10);
    }

    it("shows the first 10", async () => {
      fakeIntersectionObserver();
      const { user } = renderWithClient(<SearchPage />);
      await searchByName(user);

      expect(cards()).toHaveLength(10);
      expect(offsets()).toEqual([null]);
      expect(map()).toHaveAttribute("data-shops", "10");
    });

    it("loads the next pages when scrolling to the end, until there are no more", async () => {
      const io = fakeIntersectionObserver();
      const { user } = renderWithClient(<SearchPage />);
      await searchByName(user);

      io.scrollToEnd();
      await waitFor(() => expect(cards()).toHaveLength(20));
      io.scrollToEnd();
      await waitFor(() => expect(cards()).toHaveLength(23));

      expect(offsets()).toEqual([null, "10", "20"]);
      expect(screen.queryByRole("button", { name: "Cargar más tiendas" })).not.toBeInTheDocument();
      expect(map()).toHaveAttribute("data-shops", "23"); // the map shows everything loaded
      expect(map()).toHaveAttribute("data-fit", "false"); // and stops re-fitting after page 1
    });

    it("has a button to load more without scrolling", async () => {
      const { user } = renderWithClient(<SearchPage />); // no IntersectionObserver in jsdom
      await searchByName(user);

      await user.click(screen.getByRole("button", { name: "Cargar más tiendas" }));
      await waitFor(() => expect(cards()).toHaveLength(20));
      expect(offsets()).toEqual([null, "10"]);
    });

    it("sends the offset for area searches too", async () => {
      areaCalls = recorder();
      server.use(
        http.post("/api/shops/search-area", async ({ request }) => {
          await areaCalls.record(request);
          const { offset = 0 } = (await request.clone().json()) as { offset?: number };
          return HttpResponse.json(page(many(10, offset + 1), 15, offset === 0 ? 10 : null));
        }),
      );
      const { user } = renderWithClient(<SearchPage />);
      await user.click(screen.getByRole("button", { name: "Dibujar zona" }));
      await expectResults(10);

      await user.click(screen.getByRole("button", { name: "Cargar más tiendas" }));
      await waitFor(() => expect(areaCalls.calls).toHaveLength(2));
      expect(areaCalls.calls[0]!.body).toEqual({ area: AREA });
      expect(areaCalls.calls[1]!.body).toEqual({ area: AREA, offset: 10 });
    });

    it("starts again from the first page on a new search", async () => {
      const { user } = renderWithClient(<SearchPage />);
      await searchByName(user);
      await user.click(screen.getByRole("button", { name: "Cargar más tiendas" }));
      await waitFor(() => expect(cards()).toHaveLength(20));

      await user.type(nameInput(), " 1");
      await user.click(searchButton());

      await waitFor(() => expect(pageCalls.calls).toHaveLength(3));
      expect(new URL(pageCalls.calls[2]!.url).searchParams.get("offset")).toBeNull();
      await waitFor(() => expect(cards()).toHaveLength(10));
    });
  });
});
