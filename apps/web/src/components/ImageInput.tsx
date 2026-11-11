"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ImageKind } from "@/lib/images";
import { ImageCropDialog } from "./ImageCropDialog";

/**
 * File input that makes the user crop the chosen image to the ratio it is shown in.
 * Controlled: `value` is the cropped file (null = keep `currentUrl` / no image). The
 * input itself has no `name`, so the form must add `value` to its FormData.
 */
export function ImageInput({
  kind,
  value,
  onChange,
  currentUrl,
  required,
  label = "Imagen",
}: {
  kind: ImageKind;
  value: File | null;
  onChange: (file: File | null) => void;
  currentUrl?: string | null;
  required?: boolean;
  label?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  /** The original picked file: what the crop dialog works on (also for "Ajustar recorte"). */
  const [source, setSource] = useState<File | null>(null);
  /** The original behind `value`, to go back to if a new pick's crop is cancelled. */
  const [valueSource, setValueSource] = useState<File | null>(null);
  const [cropping, setCropping] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return setPreviewUrl(null);
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  // The parent cleared the value (e.g. the form was reset): forget the picked file too.
  useEffect(() => {
    if (value) return;
    setSource(null);
    setValueSource(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [value]);

  const preview = previewUrl ?? currentUrl ?? null;

  function cancelCrop() {
    setCropping(false);
    // Keep the previous crop. With none, drop the pick so `required` stays truthful.
    setSource(valueSource);
    if (!value && inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vista previa" className={`h-16 ${kind.className} rounded-lg border border-line object-cover`} />
        ) : (
          <div className={`h-16 ${kind.className} rounded-lg border border-dashed border-line-strong bg-canvas`} />
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required={required}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:text-fg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setSource(file);
            setCropping(true);
          }}
        />
        {source && value && (
          <button type="button" className="btn btn-sm" onClick={() => setCropping(true)}>
            Ajustar recorte
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-fg-subtle">JPG, PNG o WEBP. Máximo 5 MB. Podrás recortarla antes de guardar.</p>
      {cropping && source && (
        <ImageCropDialog
          file={source}
          aspect={kind.aspect}
          maxWidth={kind.maxWidth}
          onCancel={cancelCrop}
          onCropped={(file) => {
            setCropping(false);
            setValueSource(source);
            onChange(file);
          }}
        />
      )}
    </div>
  );
}
