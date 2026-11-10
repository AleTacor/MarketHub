"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useState, type FormEvent } from "react";
import { postalCodeSchema, type AreaSearchResponse, type GeoPolygon, type ShopListResponse } from "@markethub/shared";
import { AreaSelectMap } from "@/components/maps";
import { ShopCard } from "@/components/ShopCard";
import { api, errorMessage } from "@/lib/api";

type Search =
  | { kind: "area"; area: GeoPolygon; q: string }
  | { kind: "postalCode"; postalCode: string; q: string }
  | { kind: "name"; q: string };

function fetchShops(search: Search): Promise<AreaSearchResponse | ShopListResponse> {
  if (search.kind === "area") {
    return api<AreaSearchResponse>("/api/shops/search-area", {
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

  const { data, isFetching, error } = useQuery({
    queryKey: ["shops", "search", search],
    queryFn: () => fetchShops(search!),
    enabled: search !== null,
    placeholderData: (prev) => prev,
  });
  const shops = search ? (data?.shops ?? []) : [];
  const areaPostalCodes = search?.kind === "area" && data && "postalCodes" in data ? data.postalCodes : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const q = name.trim();
    if (postalCode.trim()) {
      const cp = postalCodeSchema.safeParse(postalCode);
      if (!cp.success) return setFormError(cp.error.issues[0]!.message);
      setClearKey((k) => k + 1); // a postal code search replaces the drawn area
      return setSearch({ kind: "postalCode", postalCode: cp.data, q });
    }
    if (search?.kind === "area") return setSearch({ ...search, q });
    if (q) return setSearch({ kind: "name", q });
    setFormError("Introduce un código postal, un nombre o dibuja una zona en el mapa");
  }

  const handleAreaChange = useCallback(
    (area: GeoPolygon | null) => {
      setFormError(null);
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
            fitToShops={search?.kind !== "area"}
          />
        </div>

        <section className="space-y-3">
          {!search && <p className="text-fg-subtle">Aún no has buscado nada.</p>}
          {error && <p className="error-box">{errorMessage(error)}</p>}
          {search && !error && (
            <div className="text-sm text-fg-subtle">
              {isFetching ? "Buscando…" : `${shops.length} ${shops.length === 1 ? "tienda encontrada" : "tiendas encontradas"}`}
              {areaPostalCodes && areaPostalCodes.length > 0 && (
                <span> · Códigos postales en la zona: {areaPostalCodes.join(", ")}</span>
              )}
            </div>
          )}
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
          {search && !isFetching && !error && shops.length === 0 && (
            <p className="card p-6 text-center text-fg-subtle">No hay tiendas que coincidan con tu búsqueda.</p>
          )}
        </section>
      </div>
    </div>
  );
}
