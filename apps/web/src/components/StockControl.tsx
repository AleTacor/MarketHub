"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Product, ShopDetail } from "@markethub/shared";
import { api, errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/hooks";

/**
 * Inline stock editor: −/+ buttons and a number field that saves on blur/Enter.
 * Updates the cached shop optimistically and rolls back on error.
 */
export function StockControl({ product }: { product: Product }) {
  const qc = useQueryClient();
  const key = queryKeys.shop(product.shopId);
  const [draft, setDraft] = useState(String(product.stock));

  useEffect(() => setDraft(String(product.stock)), [product.stock]);

  const mutation = useMutation({
    mutationKey: ["stock", product.id],
    mutationFn: (stock: number) => api<Product>(`/api/products/${product.id}/stock`, { method: "PATCH", json: { stock } }),
    onMutate: async (stock) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ShopDetail>(key);
      qc.setQueryData<ShopDetail>(key, (old) =>
        old && { ...old, products: old.products.map((p) => (p.id === product.id ? { ...p, stock } : p)) },
      );
      return { previous };
    },
    onError: (_err, _stock, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      // Refetch once the last pending change for this product has finished.
      if (qc.isMutating({ mutationKey: ["stock", product.id] }) === 1) qc.invalidateQueries({ queryKey: key });
    },
  });

  const commit = (value: number) => {
    if (!Number.isInteger(value) || value < 0) return setDraft(String(product.stock));
    if (value !== product.stock) mutation.mutate(value);
  };

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-sm h-8 w-8 p-0"
          aria-label="Restar uno"
          disabled={product.stock <= 0}
          onClick={() => commit(product.stock - 1)}
        >
          −
        </button>
        <input
          type="number"
          min={0}
          aria-label="Cantidad disponible"
          className="input h-8 w-20 px-2 text-center"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // An emptied field reverts instead of saving 0 (Number("") === 0).
          onBlur={() => commit(draft.trim() === "" ? NaN : Number(draft))}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <button type="button" className="btn btn-sm h-8 w-8 p-0" aria-label="Sumar uno" onClick={() => commit(product.stock + 1)}>
          +
        </button>
      </div>
      {mutation.isError && <p className="mt-1 text-xs text-danger">{errorMessage(mutation.error)}</p>}
    </div>
  );
}
