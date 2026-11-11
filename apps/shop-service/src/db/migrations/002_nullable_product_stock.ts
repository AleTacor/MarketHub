import type { Knex } from "knex";

// Stock is optional: NULL means the owner doesn't track a quantity for the product.
// The existing CHECK (stock >= 0) already lets NULL through.
export async function up(k: Knex) {
  await k.raw("ALTER TABLE products ALTER COLUMN stock DROP NOT NULL, ALTER COLUMN stock DROP DEFAULT");
}

export async function down(k: Knex) {
  await k.raw("UPDATE products SET stock = 0 WHERE stock IS NULL");
  await k.raw("ALTER TABLE products ALTER COLUMN stock SET DEFAULT 0, ALTER COLUMN stock SET NOT NULL");
}
