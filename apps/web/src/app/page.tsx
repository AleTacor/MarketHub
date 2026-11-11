"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { postalCodeSchema, type GeoPolygon, type ShopListResponse } from "@markethub/shared";
import { AreaSelectMap } from "@/components/maps";
import { ShopCard } from "@/components/ShopCard";
import { api, errorMessage } from "@/lib/api";
import { loadSavedSearch, saveSearch } from "@/lib/savedSearch";

type Search =
  | { kind: "area"; area: GeoPolygon; q: string }
  | { kind: "postalCode"; postalCode: string; q: string }
  | { kind: "name"; q: string };

function fetchShops(search: Search): Promise<ShopListResponse> {
  if (search.kind === "area") {
    return api<ShopListResponse>("/api/shops/search-area", {
      method: "POST",
      json: { area: search.area, q: search.q || undefined },
    });
  }
  const params = new URLSearchParams();
  if (search.kind === "postalCode") params.set("postalCode", search.postalCode);
  if (search.q) params.set("q", search.q);
  return api<ShopListResponse>(`/api/shops?${params}`);
}

// Public: customers can search without an account.
export default function SearchPage() {
  const [postalCode, setPostalCode] = useState("");
  const [name, setName] = useState("");
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
      setSearch({ kind: "area", area: saved.area, q: "" });
    } else if (saved?.kind === "postalCode") {
      setPostalCode(saved.postalCode);
      setSearch({ kind: "postalCode", postalCode: saved.postalCode, q: "" });
    }
  }, []);

  const { data, isFetching, error } = useQuery({
    queryKey: ["shops", "search", search],
    queryFn: () => fetchShops(search!),
    enabled: search !== null,
    placeholderData: (prev) => prev,
  });
  const shops = search ? (data?.shops ?? []) : [];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const q = name.trim();
    if (postalCode.trim()) {
      const cp = postalCodeSchema.safeParse(postalCode);
      if (!cp.success) return setFormError(cp.error.issues[0]!.message);
      setClearKey((k) => k + 1); // a postal code search replaces the drawn area
      saveSearch({ kind: "postalCode", postalCode: cp.data });
      return setSearch({ kind: "postalCode", postalCode: cp.data, q });
    }
    if (search?.kind === "area") return setSearch({ ...search, q });
    if (q) {
      saveSearch(null); // a name-only search isn't remembered, and replaces the saved one
      return setSearch({ kind: "name", q });
    }
    setFormError("Introduce un código postal, un nombre o dibuja una zona en el mapa");
  }

  const handleAreaChange = useCallback(
    (area: GeoPolygon | null) => {
      setFormError(null);
      saveSearch(area && { kind: "area", area });
      if (area) {
        setPostalCode("");
        setSearch({ kind: "area", area, q: name.trim() });
      } else {
        setSearch((s) => (s?.kind === "area" ? null : s));
      }
    },
    [name],
  );

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
            fitToShops={search?.kind !== "area"}
          />
        </div>

        {/* Fixed height (the map's, on desktop): many results scroll inside instead of growing the page. */}
        <section className="flex min-h-0 flex-col gap-3 lg:h-[calc(100vh-7rem)]">
          {!search && <p className="text-fg-subtle">Aún no has buscado nada.</p>}
          {error && <p className="error-box">{errorMessage(error)}</p>}
          {search && !error && (
            <div className="text-sm text-fg-subtle">
              {isFetching ? "Buscando…" : `${shops.length} ${shops.length === 1 ? "tienda encontrada" : "tiendas encontradas"}`}
              {!isFetching && search.kind === "area" && " en la zona dibujada"}
            </div>
          )}
          {shops.length > 0 && (
            // p-1: room for the cards' hover border/shadow, which overflow would clip.
            <ul aria-label="Tiendas encontradas" className="-m-1 max-h-[70vh] min-h-0 flex-1 space-y-3 overflow-y-auto p-1 lg:max-h-none">
              {shops.map((shop) => (
                <li key={shop.id}>
                  <ShopCard shop={shop} />
                </li>
              ))}
            </ul>
          )}
          {search && !isFetching && !error && shops.length === 0 && (
            <p className="card p-6 text-center text-fg-subtle">No hay tiendas que coincidan con tu búsqueda.</p>
          )}
        </section>
      </div>
    </div>
  );
}
