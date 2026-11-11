// Leaflet-Geoman patches the global `L` instead of importing Leaflet, and bundlers
// don't expose one. Import this module before "@geoman-io/leaflet-geoman-free".
import L from "leaflet";

declare global {
  interface Window {
    L: typeof L;
  }
}

window.L = L;
