"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
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

/** Click on the map to set the shop's location. */
export default function LocationPickerMap({ value, onChange }: { value: LatLng | null; onChange: (p: LatLng) => void }) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : SPAIN_CENTER}
      zoom={value ? 16 : SPAIN_ZOOM}
      className="h-full w-full cursor-crosshair"
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <ClickHandler onChange={onChange} />
      {value && <CircleMarker center={[value.lat, value.lng]} radius={9} pathOptions={MARKER_STYLE} />}
    </MapContainer>
  );
}
