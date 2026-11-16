"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { postalCodeSchema, type GeoPolygon, type ShopSearchPage, type ShopType } from "@markethub/shared";
import { AreaSelectMap } from "@/components/maps";
import { MobileFold } from "@/components/MobileFold";
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

/**
 * After drawing or editing an area, the mobile panel waits this long before folding
 * away, so the user sees the area they just drew (a search by the form folds at once).
 */
const AREA_FOLD_DELAY_MS = 300;

/** One line describing the current search, for the collapsed panel on mobile. */
function describeSearch(search: Search, shopTypes: ShopType[]) {
  const parts = [
    search.kind === "area" ? "Zona del mapa" : search.kind === "postalCode" ? `Código postal ${search.postalCode}` : null,
    search.q ? `“${search.q}”` : null,
    shopTypes.find((t) => t.id === search.shopTypeId)?.name ?? null,
  ];
  return parts.filter(Boolean).join(" · ");
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
  /**
   * Mobile only (map and results are stacked there): after a search the form and map
   * fold away so the results show; the toggle opens them again. Desktop always shows both.
   * A search restored on load folds them too, but without animation (see `layoutAnimated`).
   */
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  /**
   * False until the user does something (searches, draws, uses the toggle): what a
   * restored search changes on load (panel folded, results shown) shouldn't animate.
   */
  const [layoutAnimated, setLayoutAnimated] = useState(false);
  const panelId = useId();
  const foldTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelFold = useCallback(() => clearTimeout(foldTimer.current), []);
  /** Folds the mobile panel now, or after `delay` ms (a new call restarts the wait). */
  const foldPanel = useCallback(
    (delay = 0) => {
      cancelFold();
      setLayoutAnimated(true);
      if (delay) foldTimer.current = setTimeout(() => setPanelCollapsed(true), delay);
      else setPanelCollapsed(true);
    },
    [cancelFold],
  );
  useEffect(() => cancelFold, [cancelFold]);

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
    // Mobile: show the restored results straight away; the bar's toggle opens the form and map.
    if (saved) setPanelCollapsed(true);
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
      foldPanel();
      return setSearch({ kind: "postalCode", postalCode: cp.data, ...filters });
    }
    if (search?.kind === "area") {
      foldPanel();
      return setSearch({ ...search, ...filters });
    }
    if (q) {
      saveSearch(null); // a name-only search isn't remembered, and replaces the saved one
      foldPanel();
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
        foldPanel(AREA_FOLD_DELAY_MS);
        setSearch({ kind: "area", area, q: name.trim(), shopTypeId });
      } else {
        cancelFold();
        setLayoutAnimated(true); // the results hide, animated
        setSearch((s) => (s?.kind === "area" ? null : s));
      }
    },
    [name, shopTypeId, foldPanel, cancelFold],
  );

  /** A select has no "submit" moment: the type applies to the current search at once. */
  function handleTypeChange(value: string) {
    const id = value ? Number(value) : null;
    setShopTypeId(id);
    setSearch((s) => (s ? { ...s, shopTypeId: id } : s));
  }

  // Nothing searched (or the area was removed): nothing to fold away, no results to show.
  const collapsed = panelCollapsed && search !== null;
  const showResults = search !== null;
  const layoutTransition = layoutAnimated ? "duration-700 ease-in-out motion-reduce:transition-none" : "";

  return (
    // Desktop: one screen tall, no window scroll. Title and form keep their height and
    // the map/results row takes the rest (the list scrolls inside it).
    <div className="fit-viewport space-y-6 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
      <section>
        <h1 className="text-2xl font-semibold">Encuentra tiendas cerca de ti</h1>
        <p className="text-fg-subtle">
          Escribe tu código postal o dibuja una zona en el mapa con las herramientas de la izquierda.
        </p>
      </section>

      {/* Mobile: what is being searched, and a button to show or hide the form and map.
          Above them (z-10, opaque card), so they seem to slide in and out behind it. */}
      {search && (
        <div className="card relative z-10 flex items-center gap-3 px-4 py-2 lg:hidden">
          <p className="break-anywhere min-w-0 flex-1 text-sm text-fg-muted">{describeSearch(search, shopTypes)}</p>
          <button
            type="button"
            className="btn btn-sm shrink-0"
            aria-expanded={!collapsed}
            aria-controls={`${panelId}-form ${panelId}-map`}
            onClick={() => {
              cancelFold(); // the user decides now
              setLayoutAnimated(true);
              setPanelCollapsed(!collapsed);
            }}
          >
            {collapsed ? "Cambiar búsqueda" : "Ocultar búsqueda"}
          </button>
        </div>
      )}

      {/* Mobile: the gap above is inside the fold (pt-6 instead of the parent's space-y), so it folds away too. */}
      <MobileFold id={`${panelId}-form`} collapsed={collapsed} animated={layoutAnimated} className="max-lg:!mt-0" innerClassName="max-lg:pt-6">
        <form aria-label="Buscar tiendas" onSubmit={handleSubmit} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
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
      </MobileFold>
      {formError && <p className="error-box">{formError}</p>}

      {/* min-h: on a very short window the page scrolls rather than squashing the map.
          Desktop: until something is searched the map takes the whole width; then the
          results column opens (grid columns and gap animate, the map narrows with them). */}
      <div
        className={`grid gap-6 max-lg:gap-y-0 lg:min-h-[22rem] lg:flex-1 lg:grid-rows-[minmax(0,1fr)] ${
          layoutAnimated ? `lg:transition-[grid-template-columns,column-gap] ${layoutTransition}` : ""
        } ${showResults ? "lg:grid-cols-[1fr_1.1fr]" : "lg:grid-cols-[1fr_0fr] lg:gap-x-0"}`}
      >
        {/* Folded, not unmounted: the map keeps its drawn area and view. Mobile: the gap
            below it is inside the fold (pb-6 instead of the grid gap), so it folds away too. */}
        <MobileFold id={`${panelId}-map`} collapsed={collapsed} animated={layoutAnimated} innerClassName="max-lg:pb-6">
          <div className="h-[420px] overflow-hidden rounded-xl border border-line lg:h-full">
            <AreaSelectMap
              shops={shops}
              onAreaChange={handleAreaChange}
              clearKey={clearKey}
              restoredArea={restoredArea}
              // Fit to the first page only: loading more while scrolling shouldn't move the map.
              fitToShops={search?.kind !== "area" && pages.length <= 1}
            />
          </div>
        </MobileFold>

        {/* Hidden until something is searched. Mobile: slides down under the map (rows
            0fr → 1fr); desktop: its column opens (above). Both fade; hidden it is
            `invisible`, out of the tab order and the accessibility tree. */}
        <div
          data-shown={showResults}
          className={`grid min-w-0 lg:!grid-rows-[minmax(0,1fr)] ${
            layoutAnimated ? `transition-[grid-template-rows,opacity,visibility] ${layoutTransition}` : ""
          } ${showResults ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] overflow-hidden opacity-0"}`}
        >
          {/* As tall as the map on desktop: many results scroll inside instead of growing the page. */}
          <section aria-label="Resultados" className="flex min-h-0 flex-col gap-3">
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
    </div>
  );
}
