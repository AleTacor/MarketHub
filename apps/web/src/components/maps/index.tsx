"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` on import, so maps are client-only.
const loading = () => <div className="h-full w-full animate-pulse rounded-xl bg-surface-muted" />;

export const AreaSelectMap = dynamic(() => import("./AreaSelectMap"), { ssr: false, loading });
export const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), { ssr: false, loading });
export const ShopLocationMap = dynamic(() => import("./ShopLocationMap"), { ssr: false, loading });
export type { LatLng } from "./LocationPickerMap";
