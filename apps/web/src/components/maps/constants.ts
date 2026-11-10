import type { LatLngTuple } from "leaflet";

export const SPAIN_CENTER: LatLngTuple = [40.4168, -3.7038];
export const SPAIN_ZOOM = 6;
export const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
// CircleMarker avoids Leaflet's default PNG marker icons, which break with bundlers.
export const MARKER_STYLE = { color: "#15803d", fillColor: "#16a34a", fillOpacity: 0.85, weight: 2 };
