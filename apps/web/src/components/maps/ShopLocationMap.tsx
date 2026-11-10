"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { MARKER_STYLE, TILE_ATTRIBUTION, TILE_URL } from "./constants";

export default function ShopLocationMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  return (
    <MapContainer center={[lat, lng]} zoom={16} className="h-full w-full">
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <CircleMarker center={[lat, lng]} radius={10} pathOptions={MARKER_STYLE}>
        <Popup>{name}</Popup>
      </CircleMarker>
    </MapContainer>
  );
}
