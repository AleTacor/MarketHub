"use client";

import { useEffect, useId, useState } from "react";

/** File input with a preview of the selected (or current) image. */
export function ImageInput({
  name = "image",
  currentUrl,
  required,
  label = "Imagen",
}: {
  name?: string;
  currentUrl?: string | null;
  required?: boolean;
  label?: string;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);

  useEffect(() => setPreview(currentUrl ?? null), [currentUrl]);

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vista previa" className="h-16 w-16 rounded-lg border border-line object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-lg border border-dashed border-line-strong bg-canvas" />
        )}
        <input
          id={id}
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp"
          required={required}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:text-fg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : (currentUrl ?? null));
          }}
        />
      </div>
      <p className="mt-1 text-xs text-fg-subtle">JPG, PNG o WEBP. Máximo 5 MB.</p>
    </div>
  );
}
