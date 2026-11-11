"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
// Must run before Geoman, which needs the global `L`.
import "./leaflet-global";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { GeoPolygon, ShopSummary } from "@markethub/shared";
import { MARKER_STYLE, SPAIN_CENTER, SPAIN_ZOOM, TILE_ATTRIBUTION, TILE_URL } from "./constants";

export interface AreaSelectMapProps {
  shops: ShopSummary[];
  onAreaChange: (area: GeoPolygon | null) => void;
  /** Change this value to remove the drawn area from outside. */
  clearKey: number;
  /** Zoom to the shops whenever they change (used for postal-code searches). */
  fitToShops: boolean;
}

function DrawControl({ onAreaChange, clearKey }: Pick<AreaSelectMapProps, "onAreaChange" | "clearKey">) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  const callbackRef = useRef(onAreaChange);
  callbackRef.current = onAreaChange;

  useEffect(() => {
    map.pm.setLang("es");
    map.pm.addControls({
      position: "topleft",
      drawRectangle: true,
      drawPolygon: true,
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawCircle: false,
      drawText: false,
      cutPolygon: false,
      rotateMode: false,
      dragMode: false,
      editMode: true,
      removalMode: true,
    });

    const emit = (layer: L.Layer) => {
      const geometry = (layer as L.Polygon).toGeoJSON().geometry;
      if (geometry.type === "Polygon") callbackRef.current(geometry as GeoPolygon);
    };
    const onCreate = (e: { layer: L.Layer }) => {
      // Only one area at a time.
      if (layerRef.current) map.removeLayer(layerRef.current);
      layerRef.current = e.layer;
      e.layer.on("pm:edit", () => emit(e.layer));
      emit(e.layer);
    };
    const onRemove = (e: { layer: L.Layer }) => {
      if (e.layer === layerRef.current) {
        layerRef.current = null;
        callbackRef.current(null);
      }
    };

    map.on("pm:create", onCreate);
    map.on("pm:remove", onRemove);
    return () => {
      map.off("pm:create", onCreate);
      map.off("pm:remove", onRemove);
      map.pm.removeControls();
    };
  }, [map]);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
  }, [clearKey, map]);

  return null;
}

function FitToShops({ shops, enabled }: { shops: ShopSummary[]; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || shops.length === 0) return;
    map.fitBounds(L.latLngBounds(shops.map((s) => [s.lat, s.lng])), { padding: [40, 40], maxZoom: 15 });
  }, [shops, enabled, map]);
  return null;
}

export default function AreaSelectMap({ shops, onAreaChange, clearKey, fitToShops }: AreaSelectMapProps) {
  return (
    <MapContainer center={SPAIN_CENTER} zoom={SPAIN_ZOOM} className="h-full w-full">
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <DrawControl onAreaChange={onAreaChange} clearKey={clearKey} />
      <FitToShops shops={shops} enabled={fitToShops} />
      {shops.map((s) => (
        <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={7} pathOptions={MARKER_STYLE}>
          <Popup>
            <a href={`/tiendas/${s.id}`} className="font-semibold">
              {s.name}
            </a>
            <br />
            {s.shopType.name} · CP {s.postalCode}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
