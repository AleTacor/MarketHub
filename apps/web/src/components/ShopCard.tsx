import Link from "next/link";
import type { ShopSummary } from "@markethub/shared";

export function ShopCard({ shop, href = `/tiendas/${shop.id}` }: { shop: ShopSummary; href?: string }) {
  return (
    <Link href={href} className="card flex gap-4 overflow-hidden p-3 transition hover:border-brand-500 hover:shadow">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shop.imageUrl} alt={shop.name} className="h-24 w-24 flex-none rounded-lg bg-surface-muted object-cover" />
      <div className="min-w-0">
        <h3 className="truncate font-semibold">{shop.name}</h3>
        <p className="text-xs text-fg-subtle">
          {shop.shopType.name} · CP {shop.postalCode}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{shop.description || "Sin descripción"}</p>
      </div>
    </Link>
  );
}
