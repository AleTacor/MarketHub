"use client";

import { useEffect, useId, useState } from "react";
import Cropper from "react-easy-crop";
import { cropImage, type CropArea } from "@/lib/crop";

export interface ImageCropDialogProps {
  file: File;
  aspect: number;
  maxWidth: number;
  onCancel: () => void;
  onCropped: (file: File) => void;
}

/** Modal to pick the part of an image that will be shown (drag to move, zoom). */
export function ImageCropDialog({ file, aspect, maxWidth, onCancel, onCropped }: ImageCropDialogProps) {
  const id = useId();
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function apply() {
    if (!area) return;
    setPending(true);
    setError(null);
    try {
      onCropped(await cropImage(file, area, maxWidth));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo recortar la imagen");
      setPending(false);
    }
  }

  return (
    // Above Leaflet's panes and controls (z-index up to 1000).
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="card w-full max-w-xl space-y-4 p-5">
        <div>
          <h2 id={`${id}-title`} className="text-lg font-semibold">Recortar imagen</h2>
          <p className="text-sm text-fg-muted">Arrastra la imagen y usa el zoom para elegir la parte que se mostrará.</p>
        </div>
        <div className="relative h-72 overflow-hidden rounded-lg bg-surface-muted sm:h-80">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>
        <div>
          <label className="label" htmlFor={`${id}-zoom`}>Zoom</label>
          <input
            id={`${id}-zoom`}
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-brand-600"
          />
        </div>
        {error && <p className="error-box">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!area || pending} onClick={apply}>
            {pending ? "Recortando…" : "Aplicar recorte"}
          </button>
        </div>
      </div>
    </div>
  );
}
