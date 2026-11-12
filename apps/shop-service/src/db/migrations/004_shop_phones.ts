import type { Knex } from "knex";

// Up to 3 Spanish phone numbers, as a JSON array of 9-digit strings.
export async function up(k: Knex) {
  await k.raw("ALTER TABLE shops ADD COLUMN phones jsonb NOT NULL DEFAULT '[]'::jsonb");
}

export async function down(k: Knex) {
  await k.raw("ALTER TABLE shops DROP COLUMN phones");
}
