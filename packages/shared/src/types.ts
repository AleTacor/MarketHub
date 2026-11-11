import type { Role } from "./constants";

export interface User {
  id: number;
  name: string;
  role: Role;
}

export interface ShopType {
  id: number;
  name: string;
}

export interface ShopSummary {
  id: number;
  ownerId: number;
  name: string;
  description: string;
  postalCode: string;
  imageUrl: string;
  shopType: ShopType;
  lat: number;
  lng: number;
}

export interface Product {
  id: number;
  shopId: number;
  name: string;
  description: string;
  imageUrl: string | null;
  /** `null`: the shop doesn't track a quantity for this product. */
  stock: number | null;
}

export interface ShopDetail extends ShopSummary {
  products: Product[];
}

export interface ShopListResponse {
  shops: ShopSummary[];
}

/** One page of search results. */
export interface ShopSearchPage {
  shops: ShopSummary[];
  /** Matching shops across all pages. */
  total: number;
  /** `offset` of the next page, or null on the last one. */
  nextOffset: number | null;
}

/** One match for an address typed by a shop owner. */
export interface GeocodeResult {
  /** Full address as returned by the geocoder, to show in the list. */
  label: string;
  lat: number;
  lng: number;
  /** The one typed in the query, else the found door's; null when unknown. */
  postalCode: string | null;
  /** True when the exact door was found; false means a point on the street (or town). */
  exact: boolean;
}

export interface GeocodeResponse {
  results: GeocodeResult[];
}

export interface ApiErrorBody {
  error: string;
}
