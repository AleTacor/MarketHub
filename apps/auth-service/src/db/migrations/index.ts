import type { Knex } from "knex";
import * as m001 from "./001_create_users";

type Migration = { up(k: Knex): Promise<void>; down(k: Knex): Promise<void> };

// Register new migrations here, in order. Never edit an applied migration.
const migrations: Record<string, Migration> = {
  "001_create_users": m001,
};

export const migrationSource: Knex.MigrationSource<string> = {
  getMigrations: async () => Object.keys(migrations).sort(),
  getMigrationName: (name) => name,
  getMigration: async (name) => migrations[name]!,
};
