import type { Knex } from "knex";

// Links to the shop's pages on review sites: `{ "<platform>": "<url>" }`, only the ones set.
export async function up(k: Knex) {
  await k.raw("ALTER TABLE shops ADD COLUMN review_links jsonb NOT NULL DEFAULT '{}'::jsonb");
}

export async function down(k: Knex) {
  await k.raw("ALTER TABLE shops DROP COLUMN review_links");
}
