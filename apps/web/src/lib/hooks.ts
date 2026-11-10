"use client";

import { useQuery } from "@tanstack/react-query";
import type { ShopDetail, ShopType, User } from "@markethub/shared";
import { api } from "./api";

export const queryKeys = {
  me: ["me"] as const,
  shopTypes: ["shop-types"] as const,
  myShops: ["shops", "mine"] as const,
  shop: (id: number) => ["shop", id] as const,
};

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api<{ user: User }>("/api/auth/me").then((r) => r.user),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useShopTypes() {
  return useQuery({
    queryKey: queryKeys.shopTypes,
    queryFn: () => api<{ shopTypes: ShopType[] }>("/api/shop-types").then((r) => r.shopTypes),
    staleTime: Infinity,
  });
}

export function useShop(id: number) {
  return useQuery({
    queryKey: queryKeys.shop(id),
    queryFn: () => api<ShopDetail>(`/api/shops/${id}`),
    enabled: Number.isInteger(id) && id > 0,
  });
}
