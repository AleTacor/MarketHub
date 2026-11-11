"use client";

import { useId, useState, type FormEvent } from "react";
import type { Product } from "@markethub/shared";
import { errorMessage } from "@/lib/api";
import { PRODUCT_IMAGE } from "@/lib/images";
import { ImageInput } from "./ImageInput";

export function ProductForm({
  product,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  product?: Product;
  submitLabel: string;
  onSubmit: (data: FormData) => Promise<unknown>;
  onCancel?: () => void;
}) {
  // Unique ids: several ProductForms can be on the page at once.
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [image, setImage] = useState<File | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (image) data.set("image", image);
    setError(null);
    setPending(true);
    try {
      await onSubmit(data);
      if (!product) {
        form.reset();
        setImage(null);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <div>
          <label className="label" htmlFor={`${id}-name`}>Nombre</label>
          <input id={`${id}-name`} name="name" className="input" required maxLength={100} defaultValue={product?.name} />
        </div>
        <div>
          <label className="label" htmlFor={`${id}-stock`}>Cantidad</label>
          {/* Optional: left empty, the product has no quantity. */}
          <input
            id={`${id}-stock`}
            name="stock"
            type="number"
            min={0}
            step={1}
            className="input"
            placeholder="Sin indicar"
            aria-describedby={`${id}-stock-hint`}
            defaultValue={product?.stock ?? ""}
          />
          <p id={`${id}-stock-hint`} className="mt-1 text-xs text-fg-subtle">Opcional</p>
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-description`}>Descripción</label>
        <textarea id={`${id}-description`} name="description" className="input min-h-16" maxLength={1000} defaultValue={product?.description} />
      </div>
      <ImageInput kind={PRODUCT_IMAGE} value={image} onChange={setImage} currentUrl={product?.imageUrl} label="Imagen del producto" />
      {error && <p className="error-box">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending}>
          {pending ? "Guardando…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
