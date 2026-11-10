"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ShopLocationMap } from "@/components/maps";
import { errorMessage } from "@/lib/api";
import { useMe, useShop } from "@/lib/hooks";

// Public: no account needed to see a shop and its products.
export default function ShopPage() {
  const { id } = useParams<{ id: string }>();
  const { data: shop, isLoading, error } = useShop(Number(id));
  const { data: me } = useMe(); // only to show "Gestionar" to the owner

  if (isLoading) return <p className="text-fg-subtle">Cargando tienda…</p>;
  if (error || !shop) return <p className="error-box">{error ? errorMessage(error) : "Tienda no encontrada"}</p>;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-accent hover:underline">
        ← Volver a la búsqueda
      </Link>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shop.imageUrl} alt={shop.name} className="h-56 w-full object-cover" />
          <div className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-accent">{shop.shopType.name}</p>
            <h1 className="text-2xl font-semibold">{shop.name}</h1>
            <p className="text-sm text-fg-subtle">Código postal {shop.postalCode}</p>
            {shop.description && <p className="mt-3 whitespace-pre-line text-fg-muted">{shop.description}</p>}
            {me && shop.ownerId === me.id && (
              <Link href={`/mis-tiendas/${shop.id}`} className="btn btn-sm mt-4">
                Gestionar esta tienda
              </Link>
            )}
          </div>
        </div>
        <div className="h-80 overflow-hidden rounded-xl border border-line md:h-auto">
          <ShopLocationMap lat={shop.lat} lng={shop.lng} name={shop.name} />
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Productos ({shop.products.length})</h2>
        {shop.products.length === 0 ? (
          <p className="card p-6 text-center text-fg-subtle">Esta tienda todavía no tiene productos.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shop.products.map((p) => (
              <li key={p.id} className="card overflow-hidden">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="h-40 w-full object-cover" />
                ) : (
                  <div className="h-40 bg-surface-muted" />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{p.name}</h3>
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.stock > 0 ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger"
                      }`}
                    >
                      {p.stock > 0 ? `${p.stock} disponibles` : "Agotado"}
                    </span>
                  </div>
                  {p.description && <p className="mt-1 text-sm text-fg-muted">{p.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
