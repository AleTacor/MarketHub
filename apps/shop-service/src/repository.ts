import type { Knex } from "knex";
import type { GeoPolygon, Product, ProductInput, ShopDetail, ShopInput, ShopSummary, ShopType } from "@markethub/shared";

const MAX_RESULTS = 200;

interface ShopRow {
  id: number;
  ownerId: number;
  name: string;
  description: string;
  postalCode: string;
  imageUrl: string;
  shopTypeId: number;
  shopTypeName: string;
  lat: number;
  lng: number;
}

const toShop = (r: ShopRow): ShopSummary => ({
  id: r.id,
  ownerId: r.ownerId,
  name: r.name,
  description: r.description,
  postalCode: r.postalCode,
  imageUrl: r.imageUrl,
  shopType: { id: r.shopTypeId, name: r.shopTypeName },
  lat: r.lat,
  lng: r.lng,
});

const PRODUCT_COLUMNS: string[] = [
  "id",
  "shop_id as shopId",
  "name",
  "description",
  "image_url as imageUrl",
  "stock",
];

/** Escapes LIKE wildcards so user input matches literally. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");
const point = (db: Knex, lat: number, lng: number) =>
  db.raw("ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography", [lng, lat]);

export function createRepository(db: Knex) {
  const shopQuery = () =>
    db("shops as s")
      .join("shop_types as t", "t.id", "s.shop_type_id")
      .select<ShopRow[]>(
        "s.id",
        "s.owner_id as ownerId",
        "s.name",
        "s.description",
        "s.postal_code as postalCode",
        "s.image_url as imageUrl",
        "s.shop_type_id as shopTypeId",
        "t.name as shopTypeName",
        db.raw("ST_Y(s.location::geometry) AS lat"),
        db.raw("ST_X(s.location::geometry) AS lng"),
      );

  return {
    listShopTypes: () => db<ShopType>("shop_types").select("id", "name").orderBy("name"),

    async searchShops(filters: { postalCode?: string; q?: string; area?: GeoPolygon; ownerId?: number }) {
      const query = shopQuery().orderBy("s.name").limit(MAX_RESULTS);
      if (filters.postalCode) query.where("s.postal_code", filters.postalCode);
      if (filters.ownerId) query.where("s.owner_id", filters.ownerId);
      if (filters.q) query.whereRaw("s.name ILIKE ?", [`%${escapeLike(filters.q)}%`]);
      if (filters.area) {
        query.whereRaw("ST_Intersects(s.location, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)::geography)", [
          JSON.stringify(filters.area),
        ]);
      }
      return (await query).map(toShop);
    },

    /** One page of a search. Ordered by name, then id, so pages never overlap or skip. */
    async searchShopsPage(filters: { postalCode?: string; q?: string; area?: GeoPolygon }, { offset, limit }: { offset: number; limit: number }) {
      const query = shopQuery()
        .select(db.raw("count(*) OVER() AS total"))
        .orderBy([{ column: "s.name" }, { column: "s.id" }])
        .offset(offset)
        .limit(limit);
      if (filters.postalCode) query.where("s.postal_code", filters.postalCode);
      if (filters.q) query.whereRaw("s.name ILIKE ?", [`%${escapeLike(filters.q)}%`]);
      if (filters.area) {
        query.whereRaw("ST_Intersects(s.location, ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)::geography)", [
          JSON.stringify(filters.area),
        ]);
      }
      const rows = (await query) as (ShopRow & { total: string })[];
      // count(*) is a bigint, which pg returns as a string. Past the last page there are no rows to carry it.
      return { shops: rows.map(toShop), total: rows.length ? Number(rows[0]!.total) : 0 };
    },

    async getShop(id: number): Promise<ShopDetail | null> {
      const row = await shopQuery().where("s.id", id).first();
      if (!row) return null;
      const products = await db("products").select<Product[]>(PRODUCT_COLUMNS).where("shop_id", id).orderBy("name");
      return { ...toShop(row), products };
    },

    getShopOwner: (id: number) =>
      db("shops").select<{ ownerId: number; imageUrl: string }>("owner_id as ownerId", "image_url as imageUrl").where({ id }).first(),

    async createShop(ownerId: number, input: ShopInput, imageUrl: string) {
      const [row] = await db("shops")
        .insert({
          owner_id: ownerId,
          name: input.name,
          description: input.description,
          postal_code: input.postalCode,
          shop_type_id: input.shopTypeId,
          image_url: imageUrl,
          location: point(db, input.lat, input.lng),
        })
        .returning<{ id: number }[]>("id");
      return row!.id;
    },

    async updateShop(id: number, input: ShopInput, imageUrl?: string) {
      await db("shops")
        .where({ id })
        .update({
          name: input.name,
          description: input.description,
          postal_code: input.postalCode,
          shop_type_id: input.shopTypeId,
          location: point(db, input.lat, input.lng),
          ...(imageUrl ? { image_url: imageUrl } : {}),
          updated_at: db.fn.now(),
        });
    },

    /** Deletes the shop (products cascade) and returns every image URL to clean up. */
    async deleteShop(id: number) {
      const productImages = await db("products").where("shop_id", id).whereNotNull("image_url").pluck<string[]>("image_url");
      const [shop] = await db("shops").where({ id }).delete().returning<{ imageUrl: string }[]>("image_url as imageUrl");
      return [shop?.imageUrl, ...productImages];
    },

    shopTypeExists: async (id: number) => !!(await db("shop_types").where({ id }).first("id")),

    /** Product joined with its shop owner, for permission checks. */
    getProductWithOwner: (id: number) =>
      db("products as p")
        .join("shops as s", "s.id", "p.shop_id")
        .select<{ id: number; shopId: number; ownerId: number; imageUrl: string | null }>(
          "p.id",
          "p.shop_id as shopId",
          "s.owner_id as ownerId",
          "p.image_url as imageUrl",
        )
        .where("p.id", id)
        .first(),

    async createProduct(shopId: number, input: ProductInput, imageUrl: string | null) {
      const [row] = await db("products")
        .insert({ shop_id: shopId, name: input.name, description: input.description, stock: input.stock, image_url: imageUrl })
        .returning<Product[]>(PRODUCT_COLUMNS);
      return row!;
    },

    async updateProduct(id: number, input: ProductInput, imageUrl?: string) {
      const [row] = await db("products")
        .where({ id })
        .update({
          name: input.name,
          description: input.description,
          stock: input.stock,
          ...(imageUrl ? { image_url: imageUrl } : {}),
          updated_at: db.fn.now(),
        })
        .returning<Product[]>(PRODUCT_COLUMNS);
      return row!;
    },

    async setStock(id: number, stock: number | null) {
      const [row] = await db("products")
        .where({ id })
        .update({ stock, updated_at: db.fn.now() })
        .returning<Product[]>(PRODUCT_COLUMNS);
      return row!;
    },

    deleteProduct: (id: number) => db("products").where({ id }).delete(),
  };
}

export type Repository = ReturnType<typeof createRepository>;
