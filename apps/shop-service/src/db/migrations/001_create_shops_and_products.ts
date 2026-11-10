import type { Knex } from "knex";

export async function up(k: Knex) {
  await k.raw("CREATE EXTENSION IF NOT EXISTS postgis");

  await k.schema.createTable("shop_types", (t) => {
    t.increments("id");
    t.string("name", 60).notNullable().unique();
  });

  await k.schema.createTable("shops", (t) => {
    t.increments("id");
    // User id from auth-service (different database, so no FK).
    t.integer("owner_id").notNullable().index();
    t.string("name", 100).notNullable();
    t.text("description").notNullable().defaultTo("");
    t.string("postal_code", 5).notNullable().index();
    t.string("image_url").notNullable();
    t.integer("shop_type_id").notNullable().references("id").inTable("shop_types").onDelete("RESTRICT");
    t.specificType("location", "geography(Point, 4326)").notNullable();
    t.timestamps(true, true);
  });
  await k.raw("CREATE INDEX shops_location_gist ON shops USING GIST (location)");

  await k.schema.createTable("products", (t) => {
    t.increments("id");
    t.integer("shop_id").notNullable().references("id").inTable("shops").onDelete("CASCADE").index();
    t.string("name", 100).notNullable();
    t.text("description").notNullable().defaultTo("");
    t.string("image_url");
    t.integer("stock").notNullable().defaultTo(0);
    t.timestamps(true, true);
  });
  await k.raw("ALTER TABLE products ADD CONSTRAINT products_stock_check CHECK (stock >= 0)");
}

export async function down(k: Knex) {
  await k.schema.dropTable("products");
  await k.schema.dropTable("shops");
  await k.schema.dropTable("shop_types");
}
