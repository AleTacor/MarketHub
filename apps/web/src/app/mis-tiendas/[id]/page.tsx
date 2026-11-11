"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { Product, ShopDetail } from "@markethub/shared";
import { ProductForm } from "@/components/ProductForm";
import { RequireUser } from "@/components/RequireUser";
import { ShopForm } from "@/components/ShopForm";
import { StockControl } from "@/components/StockControl";
import { api, errorMessage } from "@/lib/api";
import { queryKeys, useShop } from "@/lib/hooks";
import { PRODUCT_IMAGE, SHOP_IMAGE } from "@/lib/images";

export default function ManageShopPage() {
  const { id } = useParams<{ id: string }>();
  return <RequireUser role="empresario">{(user) => <ManageShop id={Number(id)} userId={user.id} />}</RequireUser>;
}

function ManageShop({ id, userId }: { id: number; userId: number }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: shop, isLoading, error } = useShop(id);
  const [editingShop, setEditingShop] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);

  if (isLoading) return <p className="text-fg-subtle">Cargando…</p>;
  if (error || !shop) return <p className="error-box">{error ? errorMessage(error) : "Tienda no encontrada"}</p>;
  if (shop.ownerId !== userId) return <p className="error-box">Esta tienda no es tuya.</p>;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: queryKeys.shop(id) });
    qc.invalidateQueries({ queryKey: queryKeys.myShops });
  };

  async function deleteShop() {
    if (!confirm(`¿Eliminar la tienda "${shop!.name}" y todos sus productos?`)) return;
    await api(`/api/shops/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: queryKeys.myShops });
    router.replace("/mis-tiendas");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/mis-tiendas" className="text-sm text-accent hover:underline">
          ← Mis tiendas
        </Link>
        <Link href={`/tiendas/${id}`} className="ml-auto text-sm text-fg-subtle hover:underline">
          Ver como cliente
        </Link>
      </div>

      <section className="card p-6">
        {editingShop ? (
          <ShopForm
            shop={shop}
            submitLabel="Guardar cambios"
            onCancel={() => setEditingShop(false)}
            onSubmit={async (data) => {
              const updated = await api<ShopDetail>(`/api/shops/${id}`, { method: "PUT", body: data });
              qc.setQueryData(queryKeys.shop(id), updated);
              qc.invalidateQueries({ queryKey: queryKeys.myShops });
              setEditingShop(false);
            }}
          />
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shop.imageUrl} alt={shop.name} className={`${SHOP_IMAGE.className} w-48 self-start rounded-lg object-cover`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-accent">{shop.shopType.name}</p>
              <h1 className="break-anywhere text-2xl font-semibold">{shop.name}</h1>
              <p className="text-sm text-fg-subtle">Código postal {shop.postalCode}</p>
              {shop.description && <p className="break-anywhere mt-2 whitespace-pre-line text-sm text-fg-muted">{shop.description}</p>}
            </div>
            <div className="flex gap-2 sm:flex-col">
              <button className="btn btn-sm" onClick={() => setEditingShop(true)}>
                Editar tienda
              </button>
              <button className="btn btn-sm btn-danger" onClick={deleteShop}>
                Eliminar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Productos ({shop.products.length})</h2>
          {!showNewProduct && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewProduct(true)}>
              + Añadir producto
            </button>
          )}
        </div>

        {showNewProduct && (
          <div className="card p-5">
            <h3 className="mb-3 font-semibold">Nuevo producto</h3>
            <ProductForm
              submitLabel="Añadir producto"
              onCancel={() => setShowNewProduct(false)}
              onSubmit={async (data) => {
                await api<Product>(`/api/shops/${id}/products`, { method: "POST", body: data });
                refresh();
                setShowNewProduct(false);
              }}
            />
          </div>
        )}

        {shop.products.length === 0 && !showNewProduct && (
          <p className="card p-6 text-center text-fg-subtle">Añade tu primer producto.</p>
        )}
        <ul className="card divide-y divide-line">
          {shop.products.map((p) => (
            <ProductRow key={p.id} product={p} onChanged={refresh} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function ProductRow({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);

  async function remove() {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    await api(`/api/products/${product.id}`, { method: "DELETE" });
    onChanged();
  }

  if (editing) {
    return (
      <li className="p-4">
        <ProductForm
          product={product}
          submitLabel="Guardar"
          onCancel={() => setEditing(false)}
          onSubmit={async (data) => {
            await api<Product>(`/api/products/${product.id}`, { method: "PUT", body: data });
            onChanged();
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-4 p-4">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt={product.name} className={`${PRODUCT_IMAGE.className} w-16 rounded-lg object-cover`} />
      ) : (
        <div className={`${PRODUCT_IMAGE.className} w-16 rounded-lg bg-surface-muted`} />
      )}
      <div className="min-w-0 flex-1">
        <p className="break-anywhere font-medium">{product.name}</p>
        <p className="truncate text-sm text-fg-subtle">{product.description || "Sin descripción"}</p>
      </div>
      <StockControl product={product} />
      <div className="flex gap-2">
        <button className="btn btn-sm" onClick={() => setEditing(true)}>
          Editar
        </button>
        <button className="btn btn-sm btn-danger" onClick={remove}>
          Eliminar
        </button>
      </div>
    </li>
  );
}
