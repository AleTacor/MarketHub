"use client";

import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { GeocodeResponse, GeocodeResult } from "@markethub/shared";
import { api, errorMessage } from "@/lib/api";

/**
 * Address field that finds the place (via `/api/geocode`) so the owner doesn't have
 * to look for it on the map. With several matches the owner picks one.
 * Not a <form>: it lives inside the shop form, so Enter searches instead of submitting.
 */
export function AddressSearch({ onPick }: { onPick: (result: GeocodeResult) => void }) {
  const id = useId();
  const [address, setAddress] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [picked, setPicked] = useState<GeocodeResult | null>(null);

  const pick = (result: GeocodeResult) => {
    onPick(result);
    setPicked(result);
    setResults(null);
  };

  const search = useMutation({
    mutationFn: (q: string) => api<GeocodeResponse>(`/api/geocode?${new URLSearchParams({ q })}`),
    onMutate: () => setPicked(null),
    onSuccess: ({ results }) => {
      // One match: use it directly.
      if (results.length === 1) pick(results[0]!);
      else setResults(results);
    },
  });

  const run = () => {
    if (address.trim()) search.mutate(address.trim());
  };

  return (
    <div className="space-y-2">
      <label className="label" htmlFor={`${id}-address`}>Dirección</label>
      <div className="flex gap-2">
        <input
          id={`${id}-address`}
          className="input"
          placeholder="Ej. Calle Mayor 1, Madrid"
          autoComplete="street-address"
          maxLength={200}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            run();
          }}
        />
        <button type="button" className="btn whitespace-nowrap" disabled={search.isPending || !address.trim()} onClick={run}>
          {search.isPending ? "Buscando…" : "Buscar dirección"}
        </button>
      </div>
      {search.isError && <p className="error-box">{errorMessage(search.error)}</p>}
      {picked && (
        <p role="status" className="text-sm text-fg-muted">
          {picked.exact
            ? `Ubicación marcada en ${picked.label}.`
            : `No hemos encontrado el número exacto: hemos marcado ${picked.label}. Haz clic en el mapa en el punto exacto de la tienda.`}
        </p>
      )}
      {results?.length === 0 && (
        <p className="text-sm text-fg-subtle">No hemos encontrado esa dirección. Prueba a escribirla de otra forma o marca la ubicación en el mapa.</p>
      )}
      {results && results.length > 1 && (
        <ul aria-label="Direcciones encontradas" className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng},${r.label}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-muted"
                onClick={() => pick(r)}
              >
                {r.label}
                {!r.exact && <span className="text-fg-subtle"> · sin número exacto</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-fg-subtle">Direcciones: © OpenStreetMap y CartoCiudad (IGN).</p>
    </div>
  );
}
