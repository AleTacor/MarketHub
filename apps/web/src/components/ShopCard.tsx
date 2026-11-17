import Link from "next/link";
import type { ShopSummary } from "@markethub/shared";
import { SHOP_IMAGE } from "@/lib/images";

export function ShopCard({ shop, href = `/negocios/${shop.id}` }: { shop: ShopSummary; href?: string }) {
  return (
    <Link href={href} className="card flex gap-4 overflow-hidden p-3 transition duration-200 hover:-translate-y-0.5 hover:border-brand-500/60 hover:shadow-lift motion-reduce:hover:translate-y-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shop.imageUrl} alt={shop.name} className={`${SHOP_IMAGE.className} w-32 flex-none self-start rounded-lg bg-surface-muted object-cover`} />
      <div className="min-w-0">
        <h3 className="truncate font-semibold text-fg">{shop.name}</h3>
        <p className="mt-0.5 inline-block rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">
          {shop.shopType.name}
        </p>
        <p className="break-anywhere mt-1 line-clamp-2 text-sm text-fg-muted">{shop.description || "Sin descripción"}</p>
      </div>
    </Link>
  );
}
