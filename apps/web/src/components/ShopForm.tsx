"use client";

import { useState, type FormEvent } from "react";
import { postalCodeSchema, type ShopDetail } from "@markethub/shared";
import { errorMessage } from "@/lib/api";
import { useShopTypes } from "@/lib/hooks";
import { ImageInput } from "./ImageInput";
import { LocationPickerMap, type LatLng } from "./maps";

/** Create / edit shop. Sends multipart/form-data so the image goes with the fields. */
export function ShopForm({
  shop,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  shop?: ShopDetail;
  submitLabel: string;
  onSubmit: (data: FormData) => Promise<unknown>;
  onCancel?: () => void;
}) {
  const { data: shopTypes = [] } = useShopTypes();
  const [location, setLocation] = useState<LatLng | null>(shop ? { lat: shop.lat, lng: shop.lng } : null);
  // Controlled: the options arrive after mount, and an uncontrolled defaultValue
  // would not select the shop's type once they do.
  const [shopTypeId, setShopTypeId] = useState(shop ? String(shop.shopType.id) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const cp = postalCodeSchema.safeParse(data.get("postalCode"));
    if (!cp.success) return setError(cp.error.issues[0]!.message);
    if (!location) return setError("Marca en el mapa dónde está la tienda");
    data.set("lat", String(location.lat));
    data.set("lng", String(location.lng));
    if ((data.get("image") as File | null)?.size === 0) data.delete("image");
    setPending(true);
    try {
      await onSubmit(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Nombre</label>
          <input id="name" name="name" className="input" required maxLength={100} defaultValue={shop?.name} />
        </div>
        <div>
          <label className="label" htmlFor="description">Descripción</label>
          <textarea id="description" name="description" className="input min-h-24" maxLength={1000} defaultValue={shop?.description} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="postalCode">Código postal</label>
            <input
              id="postalCode"
              name="postalCode"
              className="input"
              required
              inputMode="numeric"
              pattern="\d{5}"
              maxLength={5}
              placeholder="28001"
              defaultValue={shop?.postalCode}
            />
          </div>
          <div>
            <label className="label" htmlFor="shopTypeId">Tipo de tienda</label>
            <select
              id="shopTypeId"
              name="shopTypeId"
              className="input"
              required
              value={shopTypeId}
              onChange={(e) => setShopTypeId(e.target.value)}
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {shopTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ImageInput currentUrl={shop?.imageUrl} required={!shop} label="Imagen de la tienda" />
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
      </div>
      <div>
        <span className="label">Ubicación</span>
        <p className="mb-2 text-xs text-fg-subtle">Haz clic en el mapa para marcar dónde está la tienda.</p>
        <div className="h-80 overflow-hidden rounded-xl border border-line">
          <LocationPickerMap value={location} onChange={setLocation} />
        </div>
        {location && (
          <p className="mt-1 text-xs text-fg-subtle">
            {location.lat}, {location.lng}
          </p>
        )}
      </div>
    </form>
  );
}
