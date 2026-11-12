"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { postalCodeSchema, type GeoPolygon, type ShopSearchPage } from "@markethub/shared";
import { AreaSelectMap } from "@/components/maps";
import { ShopCard } from "@/components/ShopCard";
import { api, errorMessage } from "@/lib/api";
import { useShopTypes } from "@/lib/hooks";
import { loadSavedSearch, saveSearch } from "@/lib/savedSearch";
import { useInfiniteScroll } from "@/lib/useInfiniteScroll";

/** Filters that narrow any search: shop name and type (null: every type). */
type Filters = { q: string; shopTypeId: number | null };

type Search = Filters &
  ({ kind: "area"; area: GeoPolygon } | { kind: "postalCode"; postalCode: string } | { kind: "name" });

/** One page (SEARCH_PAGE_SIZE shops) of a search, starting at `offset`. */
function fetchShops(search: Search, offset: number): Promise<ShopSearchPage> {
  if (search.kind === "area") {
    return api<ShopSearchPage>("/api/shops/search-area", {
      method: "POST",
      json: { area: search.area, q: search.q || undefined, shopTypeId: search.shopTypeId ?? undefined, offset: offset || undefined },
    });
  }
  const params = new URLSearchParams();
  if (search.kind === "postalCode") params.set("postalCode", search.postalCode);
  if (search.q) params.set("q", search.q);
  if (search.shopTypeId) params.set("shopTypeId", String(search.shopTypeId));
  if (offset) params.set("offset", String(offset));
  return api<ShopSearchPage>(`/api/shops?${params}`);
}

// Public: customers can search without an account.
export default function SearchPage() {
  const [postalCode, setPostalCode] = useState("");
  const [name, setName] = useState("");
  const [shopTypeId, setShopTypeId] = useState<number | null>(null);
  const { data: shopTypes = [] } = useShopTypes();
  const [search, setSearch] = useState<Search | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [clearKey, setClearKey] = useState(0);
  /** Area saved in a previous session, for the map to draw again. */
  const [restoredArea, setRestoredArea] = useState<GeoPolygon | null>(null);

  // Restore the last area / postal-code search after mount (localStorage doesn't exist during SSR).
  useEffect(() => {
    const saved = loadSavedSearch();
    if (saved?.kind === "area") {
      setRestoredArea(saved.area);
      setSearch({ kind: "area", area: saved.area, q: "", shopTypeId: null });
    } else if (saved?.kind === "postalCode") {
      setPostalCode(saved.postalCode);
      setSearch({ kind: "postalCode", postalCode: saved.postalCode, q: "", shopTypeId: null });
    }
  }, []);

  const { data, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, error } = useInfiniteQuery({
    queryKey: ["shops", "search", search],
    queryFn: ({ pageParam }) => fetchShops(search!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    enabled: search !== null,
    placeholderData: keepPreviousData,
  });
  const pages = search ? (data?.pages ?? []) : [];
  const shops = pages.flatMap((p) => p.shops);
  /** A new search is loading (not just the next page). */
  const searching = isFetching && !isFetchingNextPage;

  // Infinite scroll: load the next page as the end of the list comes into view.
  const listRef = useRef<HTMLUListElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  useInfiniteScroll({
    sentinel: sentinelRef,
    root: listRef,
    enabled: Boolean(hasNextPage) && !isFetching,
    onLoadMore: () => void fetchNextPage(),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const filters: Filters = { q: name.trim(), shopTypeId };
    const { q } = filters;
    if (postalCode.trim()) {
      const cp = postalCodeSchema.safeParse(postalCode);
      if (!cp.success) return setFormError(cp.error.issues[0]!.message);
      setClearKey((k) => k + 1); // a postal code search replaces the drawn area
      saveSearch({ kind: "postalCode", postalCode: cp.data });
      return setSearch({ kind: "postalCode", postalCode: cp.data, ...filters });
    }
    if (search?.kind === "area") return setSearch({ ...search, ...filters });
    if (q) {
      saveSearch(null); // a name-only search isn't remembered, and replaces the saved one
      return setSearch({ kind: "name", ...filters });
    }
    setFormError("Introduce un código postal, un nombre o dibuja una zona en el mapa");
  }

  const handleAreaChange = useCallback(
    (area: GeoPolygon | null) => {
      setFormError(null);
      saveSearch(area && { kind: "area", area });
      if (area) {
        setPostalCode("");
        setSearch({ kind: "area", area, q: name.trim(), shopTypeId });
      } else {
        setSearch((s) => (s?.kind === "area" ? null : s));
      }
    },
    [name, shopTypeId],
  );

  /** A select has no "submit" moment: the type applies to the current search at once. */
  function handleTypeChange(value: string) {
    const id = value ? Number(value) : null;
    setShopTypeId(id);
    setSearch((s) => (s ? { ...s, shopTypeId: id } : s));
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Encuentra tiendas cerca de ti</h1>
        <p className="text-fg-subtle">
          Escribe tu código postal o dibuja una zona en el mapa con las herramientas de la izquierda.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="sm:w-44">
          <label className="label" htmlFor="cp">Código postal</label>
          <input
            id="cp"
            className="input"
            inputMode="numeric"
            maxLength={5}
            placeholder="Ej. 28001"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="q">Nombre de la tienda</label>
          <input id="q" className="input" placeholder="Buscar por nombre…" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="sm:w-52">
          <label className="label" htmlFor="type">Tipo de tienda</label>
          <select id="type" className="input" value={shopTypeId ?? ""} onChange={(e) => handleTypeChange(e.target.value)}>
            <option value="">Todos los tipos</option>
            {shopTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary">Buscar</button>
      </form>
      {formError && <p className="error-box">{formError}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="h-[420px] overflow-hidden rounded-xl border border-line lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
          <AreaSelectMap
            shops={shops}
            onAreaChange={handleAreaChange}
            clearKey={clearKey}
            restoredArea={restoredArea}
            // Fit to the first page only: loading more while scrolling shouldn't move the map.
            fitToShops={search?.kind !== "area" && pages.length <= 1}
          />
        </div>

        {/* Fixed height (the map's, on desktop): many results scroll inside instead of growing the page. */}
        <section className="flex min-h-0 flex-col gap-3 lg:h-[calc(100vh-7rem)]">
          {!search && <p className="text-fg-subtle">Aún no has buscado nada.</p>}
          {error && <p className="error-box">{errorMessage(error)}</p>}
          {search && !error && searching && <p className="text-sm text-fg-subtle">Buscando…</p>}
          {shops.length > 0 && (
            // p-1: room for the cards' hover border/shadow, which overflow would clip.
            <ul
              ref={listRef}
              aria-label="Tiendas encontradas"
              aria-busy={isFetchingNextPage}
              className="-m-1 max-h-[70vh] min-h-0 flex-1 space-y-3 overflow-y-auto p-1 lg:max-h-none"
            >
              {shops.map((shop) => (
                <li key={shop.id}>
                  <ShopCard shop={shop} />
                </li>
              ))}
              {hasNextPage && (
                // Watched by useInfiniteScroll; the button is the fallback (keyboard, no IntersectionObserver).
                <li ref={sentinelRef} className="py-2 text-center">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={isFetching}
                    onClick={() => void fetchNextPage()}
                  >
                    {isFetchingNextPage ? "Cargando…" : "Cargar más tiendas"}
                  </button>
                </li>
              )}
            </ul>
          )}
          {search && !searching && !error && shops.length === 0 && (
            <p className="card p-6 text-center text-fg-subtle">No hay tiendas que coincidan con tu búsqueda.</p>
          )}
        </section>
      </div>
    </div>
  );
}
