import type { Knex } from "knex";

export async function up(k: Knex) {
  await k.schema.createTable("users", (t) => {
    t.increments("id");
    t.string("name", 50).notNullable();
    t.string("password_hash").notNullable();
    t.string("role", 20).notNullable();
    t.timestamps(true, true);
  });
  await k.raw("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('empresario', 'cliente'))");
  // Usernames are unique case-insensitively.
  await k.raw("CREATE UNIQUE INDEX users_name_lower_uniq ON users (lower(name))");
}

export async function down(k: Knex) {
  await k.schema.dropTable("users");
}
