import type { Knex } from "knex";

/**
 * Shop types offered when creating a shop. The DB table is the source of
 * truth; this list only seeds it (idempotent, runs on every startup).
 * To add a type, append it here or insert it directly into `shop_types`.
 */
export const SHOP_TYPES = [
  "Alimentación",
  "Panadería y pastelería",
  "Carnicería",
  "Pescadería",
  "Frutería",
  "Restaurante",
  "Farmacia",
  "Droguería y perfumería",
  "Ropa",
  "Calzado",
  "Electrónica",
  "Ferretería",
  "Librería y papelería",
  "Floristería",
  "Juguetería",
  "Deportes",
  "Mascotas",
  "Hogar y decoración",
  "Otros",
];

export async function seedShopTypes(db: Knex) {
  await db("shop_types")
    .insert(SHOP_TYPES.map((name) => ({ name })))
    .onConflict("name")
    .ignore();
}
