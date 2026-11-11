import { z } from "zod";
import { geoPolygonSchema, postalCodeSchema, type GeoPolygon } from "@markethub/shared";

/** The last map-area or postal-code search, kept between sessions. */
export const SAVED_SEARCH_STORAGE_KEY = "mh-search";
/** Older key that only held the drawn area; read once and migrated. */
const LEGACY_AREA_KEY = "mh-search-area";

export type SavedSearch = { kind: "area"; area: GeoPolygon } | { kind: "postalCode"; postalCode: string };

const savedSearchSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("area"), area: geoPolygonSchema }),
  z.object({ kind: z.literal("postalCode"), postalCode: postalCodeSchema }),
]);

/** The saved search, or null if there is none or it is unreadable/invalid. */
export function loadSavedSearch(): SavedSearch | null {
  try {
    const raw = localStorage.getItem(SAVED_SEARCH_STORAGE_KEY);
    if (raw) {
      const parsed = savedSearchSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    }
    const legacy = localStorage.getItem(LEGACY_AREA_KEY);
    if (!legacy) return null;
    localStorage.removeItem(LEGACY_AREA_KEY);
    const area = geoPolygonSchema.safeParse(JSON.parse(legacy));
    if (!area.success) return null;
    const migrated: SavedSearch = { kind: "area", area: area.data };
    saveSearch(migrated);
    return migrated;
  } catch {
    return null; // storage blocked, or not JSON
  }
}

/** Saves the search (replacing any other), or forgets it with null. Storage failures are ignored. */
export function saveSearch(search: SavedSearch | null) {
  try {
    if (search) localStorage.setItem(SAVED_SEARCH_STORAGE_KEY, JSON.stringify(search));
    else localStorage.removeItem(SAVED_SEARCH_STORAGE_KEY);
  } catch {
    // Private mode or quota: the search just isn't remembered.
  }
}
