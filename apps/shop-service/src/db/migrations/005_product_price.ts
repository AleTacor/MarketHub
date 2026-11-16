import type { Knex } from "knex";

// Optional price, in euro cents (integer, no rounding issues). NULL means no price shown.
export async function up(k: Knex) {
  await k.raw("ALTER TABLE products ADD COLUMN price_cents integer CHECK (price_cents >= 0)");
}

export async function down(k: Knex) {
  await k.raw("ALTER TABLE products DROP COLUMN price_cents");
}
