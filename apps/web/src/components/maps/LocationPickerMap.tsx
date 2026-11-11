"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { MARKER_STYLE, SPAIN_CENTER, SPAIN_ZOOM, TILE_ATTRIBUTION, TILE_URL } from "./constants";

export interface LatLng {
  lat: number;
  lng: number;
}

function ClickHandler({ onChange }: { onChange: (p: LatLng) => void }) {
  useMapEvents({
    click: (e) => onChange({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) }),
  });
  return null;
}

/** Moves the map to `focus` whenever it changes (not on clicks, which shouldn't jump). */
function Focus({ focus }: { focus: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], 17);
  }, [focus, map]);
  return null;
}

/** Click on the map to set the shop's location. `focus` moves the view (e.g. to a found address). */
export default function LocationPickerMap({
  value,
  onChange,
  focus = null,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  focus?: LatLng | null;
}) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : SPAIN_CENTER}
      zoom={value ? 16 : SPAIN_ZOOM}
      className="h-full w-full cursor-crosshair"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <ClickHandler onChange={onChange} />
      <Focus focus={focus} />
      {value && <CircleMarker center={[value.lat, value.lng]} radius={9} pathOptions={MARKER_STYLE} />}
    </MapContainer>
  );
}
