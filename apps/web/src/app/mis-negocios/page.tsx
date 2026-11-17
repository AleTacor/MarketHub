"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ShopListResponse } from "@markethub/shared";
import { RequireUser } from "@/components/RequireUser";
import { ShopCard } from "@/components/ShopCard";
import { api, errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/hooks";

export default function MyShopsPage() {
  return <RequireUser>{() => <MyShops />}</RequireUser>;
}

function MyShops() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.myShops,
    queryFn: () => api<ShopListResponse>("/api/shops/mine").then((r) => r.shops),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mis negocios</h1>
        <Link href="/mis-negocios/nuevo" className="btn btn-primary">
          + Nuevo negocio
        </Link>
      </div>
      {isLoading && <p className="text-fg-subtle">Cargando…</p>}
      {error && <p className="error-box">{errorMessage(error)}</p>}
      {data?.length === 0 && (
        <div className="card p-8 text-center text-fg-subtle">
          Todavía no tienes negocios.{" "}
          <Link href="/mis-negocios/nuevo" className="font-medium text-accent hover:underline">
            Crea la primera
          </Link>
          .
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((shop) => (
          <ShopCard key={shop.id} shop={shop} href={`/mis-negocios/${shop.id}`} />
        ))}
      </div>
    </div>
  );
}
