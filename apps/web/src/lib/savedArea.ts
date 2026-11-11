import { geoPolygonSchema, type GeoPolygon } from "@markethub/shared";

/** The area drawn on the search map, kept between sessions. */
export const SEARCH_AREA_STORAGE_KEY = "mh-search-area";

/** The saved area, or null if there is none or it is unreadable/invalid. */
export function loadSearchArea(): GeoPolygon | null {
  try {
    const raw = localStorage.getItem(SEARCH_AREA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = geoPolygonSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // storage blocked, or not JSON
  }
}

/** Saves the area, or forgets it with null. Storage failures are ignored. */
export function saveSearchArea(area: GeoPolygon | null) {
  try {
    if (area) localStorage.setItem(SEARCH_AREA_STORAGE_KEY, JSON.stringify(area));
    else localStorage.removeItem(SEARCH_AREA_STORAGE_KEY);
  } catch {
    // Private mode or quota: the area just isn't remembered.
  }
}
