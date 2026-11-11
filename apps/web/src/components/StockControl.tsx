"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { Product, ShopDetail } from "@markethub/shared";
import { api, errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/hooks";

/** Quiet time after the last change before the stock is saved. */
export const STOCK_SAVE_DELAY_MS = 350;

type Stock = number | null;

/**
 * Inline stock editor: −/+ buttons and a number field that applies on blur/Enter.
 * Emptying the field removes the quantity (null). Every change updates the cached
 * shop at once (optimistic), but the request is debounced: a burst of changes is
 * saved once, with the final value. On error the cache goes back to how it was
 * before the burst.
 */
export function StockControl({ product }: { product: Product }) {
  const qc = useQueryClient();
  const key = queryKeys.shop(product.shopId);
  const mutationKey = ["stock", product.id];
  const shown = (stock: Stock) => (stock === null ? "" : String(stock));
  const [draft, setDraft] = useState(shown(product.stock));

  useEffect(() => setDraft(shown(product.stock)), [product.stock]);

  // The burst being debounced: its latest value and the cache from before it started.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<{ stock: Stock; previous: ShopDetail | undefined } | null>(null);

  const mutation = useMutation({
    mutationKey,
    mutationFn: ({ stock }: { stock: Stock; previous: ShopDetail | undefined }) =>
      api<Product>(`/api/products/${product.id}/stock`, { method: "PATCH", json: { stock } }),
    onError: (_err, { previous }) => {
      if (previous) qc.setQueryData(key, previous);
    },
    onSettled: () => {
      // Refetch once the last change for this product is saved, and none is waiting.
      if (qc.isMutating({ mutationKey }) === 1 && !pending.current) qc.invalidateQueries({ queryKey: key });
    },
  });

  const flush = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const burst = pending.current;
    pending.current = null;
    if (!burst) return;
    const before = burst.previous?.products.find((p) => p.id === product.id)?.stock;
    // Back where the burst started (e.g. + then −): nothing to save.
    if (burst.previous && before === burst.stock) return;
    mutation.mutate(burst);
  };

  // Save a change that is still waiting when the control goes away (e.g. navigation).
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const change = (value: Stock) => {
    if (value !== null && (!Number.isInteger(value) || value < 0)) return setDraft(shown(product.stock));
    if (value === product.stock) return;
    if (!pending.current) {
      // First change of a burst: stop refetches from overwriting it, remember the rollback point.
      void qc.cancelQueries({ queryKey: key });
      pending.current = { stock: value, previous: qc.getQueryData<ShopDetail>(key) };
    }
    pending.current.stock = value;
    qc.setQueryData<ShopDetail>(key, (old) =>
      old && { ...old, products: old.products.map((p) => (p.id === product.id ? { ...p, stock: value } : p)) },
    );
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), STOCK_SAVE_DELAY_MS);
  };

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn btn-sm h-8 w-8 p-0"
          aria-label="Restar uno"
          disabled={product.stock === null || product.stock <= 0}
          onClick={() => change((product.stock ?? 0) - 1)}
        >
          −
        </button>
        <input
          type="number"
          min={0}
          aria-label="Cantidad disponible"
          placeholder="Sin indicar"
          className="input h-8 w-24 px-2 text-center placeholder:text-xs"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Check for "" first: Number("") would be 0.
          onBlur={() => change(draft.trim() === "" ? null : Number(draft))}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <button type="button" className="btn btn-sm h-8 w-8 p-0" aria-label="Sumar uno" onClick={() => change((product.stock ?? 0) + 1)}>
          +
        </button>
      </div>
      {mutation.isError && <p className="mt-1 text-xs text-danger">{errorMessage(mutation.error)}</p>}
    </div>
  );
}
