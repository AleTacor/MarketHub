"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ShopDetail } from "@markethub/shared";
import { RequireUser } from "@/components/RequireUser";
import { ShopForm } from "@/components/ShopForm";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/hooks";

export default function NewShopPage() {
  const router = useRouter();
  const qc = useQueryClient();

  return (
    <RequireUser role="empresario">
      {() => (
        <div className="space-y-6">
          <Link href="/mis-tiendas" className="text-sm text-accent hover:underline">
            ← Mis tiendas
          </Link>
          <h1 className="text-2xl font-semibold">Nueva tienda</h1>
          <div className="card p-6">
            <ShopForm
              submitLabel="Crear tienda"
              onSubmit={async (data) => {
                const shop = await api<ShopDetail>("/api/shops", { method: "POST", body: data });
                qc.invalidateQueries({ queryKey: queryKeys.myShops });
                qc.setQueryData(queryKeys.shop(shop.id), shop);
                router.push(`/mis-tiendas/${shop.id}`);
              }}
            />
          </div>
        </div>
      )}
    </RequireUser>
  );
}
