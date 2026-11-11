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
  /** An area to draw (editable) and zoom to, e.g. one saved in a previous session. */
  restoredArea?: GeoPolygon | null;
  /** Zoom to the shops whenever they change (used for postal-code searches). */
  fitToShops: boolean;
}

/** Toolbar button that deletes the drawn area in one click (replaces Geoman's removal mode). */
const CLEAR_CONTROL = "clearArea";

function DrawControl({ onAreaChange, clearKey, restoredArea }: Pick<AreaSelectMapProps, "onAreaChange" | "clearKey" | "restoredArea">) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  const callbackRef = useRef(onAreaChange);
  callbackRef.current = onAreaChange;
  const setClearDisabled = (disabled: boolean) =>
    map.pm.Toolbar.setButtonDisabled(CLEAR_CONTROL as Parameters<typeof map.pm.Toolbar.setButtonDisabled>[0], disabled);

  const emit = (layer: L.Layer) => {
    const geometry = (layer as L.Polygon).toGeoJSON().geometry;
    if (geometry.type === "Polygon") callbackRef.current(geometry as GeoPolygon);
  };
  /** Makes `layer` the one area (replacing any other) and reports its edits. */
  const setArea = (layer: L.Layer) => {
    if (layerRef.current) map.removeLayer(layerRef.current);
    layerRef.current = layer;
    setClearDisabled(false);
    layer.on("pm:edit", () => emit(layer));
  };

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
      // There is only ever one area, so "pick a shape to delete" is a pointless step:
      // CLEAR_CONTROL below deletes it directly.
      removalMode: false,
    });
    map.pm.Toolbar.createCustomControl({
      name: CLEAR_CONTROL,
      block: "edit",
      title: "Borrar zona",
      className: "control-icon leaflet-pm-icon-delete",
      toggle: false,
      onClick: () => {
        if (!layerRef.current) return;
        map.removeLayer(layerRef.current);
        layerRef.current = null;
        setClearDisabled(true);
        callbackRef.current(null);
      },
    });
    setClearDisabled(true);

    const onCreate = (e: { layer: L.Layer }) => {
      setArea(e.layer);
      emit(e.layer);
    };

    map.on("pm:create", onCreate);
    return () => {
      map.off("pm:create", onCreate);
      map.pm.Toolbar.deleteControl(CLEAR_CONTROL);
      map.pm.removeControls();
    };
  }, [map]);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
      setClearDisabled(true);
    }
  }, [clearKey, map]);

  // Draw the restored area. No emit: the page already searches it.
  useEffect(() => {
    if (!restoredArea) return;
    // GeoJSON is [lng, lat]; L.geoJSON handles the swap.
    const layer = L.geoJSON(restoredArea).getLayers()[0] as L.Polygon | undefined;
    if (!layer) return;
    layer.addTo(map);
    setArea(layer);
    map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  }, [restoredArea, map]);

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

export default function AreaSelectMap({ shops, onAreaChange, clearKey, restoredArea, fitToShops }: AreaSelectMapProps) {
  return (
    <MapContainer center={SPAIN_CENTER} zoom={SPAIN_ZOOM} className="h-full w-full">
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <DrawControl onAreaChange={onAreaChange} clearKey={clearKey} restoredArea={restoredArea} />
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
