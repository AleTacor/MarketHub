import type { Knex } from "knex";

// Customers browse without an account, so "cliente" is no longer a role.
// (There were no cliente users when this was written; if there were, this would fail.)
export async function up(k: Knex) {
  await k.raw("ALTER TABLE users DROP CONSTRAINT users_role_check");
  await k.raw("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('empresario'))");
}

export async function down(k: Knex) {
  await k.raw("ALTER TABLE users DROP CONSTRAINT users_role_check");
  await k.raw("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('empresario', 'cliente'))");
}
