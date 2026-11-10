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
  stock: number;
}

export interface ShopDetail extends ShopSummary {
  products: Product[];
}

export interface ShopListResponse {
  shops: ShopSummary[];
}

export interface AreaSearchResponse {
  shops: ShopSummary[];
  /** Distinct postal codes of the shops found inside the area. */
  postalCodes: string[];
}

export interface ApiErrorBody {
  error: string;
}
