import { postalCodeSchema, type GeocodeResult } from "@markethub/shared";
import { HttpError } from "./errors";

/** Turns an address into coordinates. Injected into `createApp` so tests use a fake. */
export interface Geocoder {
  search(query: string): Promise<GeocodeResult[]>;
}

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

interface CartoCiudadCandidate {
  type: string;
  muni?: string;
  portalNumber?: number | null;
  postalCode?: string | null;
  lat?: number;
  lng?: number;
}

/** Nominatim's usage policy: at most one request per second. */
const MIN_INTERVAL_MS = 1000;
const TIMEOUT_MS = 8000;
const UNAVAILABLE = "No se pudo buscar la dirección. Inténtalo de nuevo o marca la ubicación en el mapa";

const round6 = (n: number) => Number(n.toFixed(6));
/** Case- and accent-insensitive comparison key ("Alcalá" = "ALCALA"). */
const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** A valid Spanish postal code typed in the query, e.g. "…, 28043 Madrid". */
export function postalCodeIn(query: string): string | null {
  for (const [match] of query.matchAll(/\b\d{5}\b/g)) {
    const parsed = postalCodeSchema.safeParse(match);
    if (parsed.success) return parsed.data;
  }
  return null;
}

/**
 * The house number typed in the query: the last 1–4 digit number, ignoring postal
 * codes and floors ("3º"). The last, so "Calle 2 de Mayo, 5" gives 5.
 */
export function houseNumberIn(query: string): string | null {
  const numbers = [...query.replace(/\b\d{5}\b/g, " ").matchAll(/\b(\d{1,4})(?![\dºª°])/g)].map((m) => m[1]!);
  return numbers.at(-1) ?? null;
}

/**
 * Address search for Spain, combining two free services:
 *
 * - **Nominatim** (OpenStreetMap) reads free text well ("Av. del Papa Negro, 22,
 *   Hortaleza…"), but often lacks house numbers, then silently returns a point on the
 *   street, and some streets carry wrong postal codes.
 * - **CartoCiudad** (IGN, official address register) has every door with its postal
 *   code, but parses free text badly. So it is only asked for "<street> <number>,
 *   <town>" as understood by Nominatim, and a candidate is used only if both number and
 *   town match.
 *
 * Results without a confirmed door are `exact: false` (the UI asks to adjust the map).
 * A postal code typed by the owner wins over the services' data.
 * Nominatim requests are spaced out per its usage policy. `fetchFn` is injectable for tests.
 */
export function createGeocoder({
  nominatimUrl,
  cartoCiudadUrl,
  userAgent,
  fetchFn = fetch,
  minIntervalMs = MIN_INTERVAL_MS,
}: {
  nominatimUrl: string;
  cartoCiudadUrl: string;
  userAgent: string;
  fetchFn?: typeof fetch;
  minIntervalMs?: number;
}): Geocoder {
  let queue: Promise<unknown> = Promise.resolve();
  let lastRequest = 0;

  // Runs `task` after the previous one, at least `minIntervalMs` after the last request.
  const throttled = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const wait = lastRequest + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();
      return task();
    });
    queue = run.catch(() => {});
    return run;
  };

  const getJson = async (url: string): Promise<unknown> => {
    const res = await fetchFn(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text.trim() ? JSON.parse(text) : null; // CartoCiudad answers "" for no match
  };

  const nominatim = (query: string) =>
    throttled(async () => {
      const params = new URLSearchParams({
        q: query,
        format: "jsonv2",
        countrycodes: "es",
        addressdetails: "1",
        limit: "5",
        "accept-language": "es",
      });
      try {
        return ((await getJson(`${nominatimUrl}?${params}`)) ?? []) as NominatimPlace[];
      } catch {
        throw new HttpError(502, UNAVAILABLE);
      }
    });

  /** The exact door from CartoCiudad, or null (not found, or the service failed: it is only a refinement). */
  const cartoCiudadDoor = async (street: string, number: string, town: string) => {
    const params = new URLSearchParams({ q: `${street} ${number}, ${town}`, limit: "5" });
    try {
      const candidates = ((await getJson(`${cartoCiudadUrl}?${params}`)) ?? []) as CartoCiudadCandidate[];
      return (
        candidates.find(
          (c) =>
            c.type === "portal" &&
            String(c.portalNumber) === number &&
            c.muni !== undefined &&
            fold(c.muni) === fold(town) &&
            typeof c.lat === "number" &&
            typeof c.lng === "number",
        ) ?? null
      );
    } catch {
      return null;
    }
  };

  return {
    async search(query) {
      const places = await nominatim(query);
      const typedPostalCode = postalCodeIn(query);
      const typedNumber = houseNumberIn(query);

      const results = await Promise.all(
        places.map(async (place): Promise<GeocodeResult> => {
          const a = place.address ?? {};
          const street = a.road ?? a.pedestrian;
          const town = a.city ?? a.town ?? a.village ?? a.municipality;
          const ownPostalCode = postalCodeSchema.safeParse(a.postcode ?? "");
          const fromPlace = { lat: round6(Number(place.lat)), lng: round6(Number(place.lon)) };

          // No street (e.g. just a town): nothing to refine.
          if (!street) {
            return { label: place.display_name, ...fromPlace, postalCode: typedPostalCode, exact: false };
          }

          let point = fromPlace;
          let number = a.house_number ?? null;
          // Street-level postal codes are unreliable (they span a whole street, some are wrong).
          let postalCode = number && ownPostalCode.success ? ownPostalCode.data : null;
          let exact = number !== null && (typedNumber === null || number === typedNumber);

          if (!exact && typedNumber && town) {
            const door = await cartoCiudadDoor(street, typedNumber, town);
            if (door) {
              point = { lat: round6(door.lat!), lng: round6(door.lng!) };
              number = typedNumber;
              postalCode = postalCodeSchema.safeParse(door.postalCode ?? "").data ?? null;
              exact = true;
            }
          }
          if (!exact) number = null; // don't show a number we couldn't place
          postalCode = typedPostalCode ?? postalCode;

          // "Avenida de los Andes, 50, 28042 Madrid": built from the parts, because
          // display_name starts with whatever business is mapped there ("Hipercor, 50, …").
          const locality = [postalCode, town].filter(Boolean).join(" ");
          const label = [street, number, locality].filter(Boolean).join(", ");
          return { label, ...point, postalCode, exact };
        }),
      );

      // Several businesses (or a building and its entrance) share one address: keep the
      // best-ranked one per label, so the owner isn't asked to choose between duplicates.
      return results.filter((r, i) => results.findIndex((o) => o.label === r.label) === i);
    },
  };
}
