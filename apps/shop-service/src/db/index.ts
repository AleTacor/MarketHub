import knexFactory, { type Knex } from "knex";
import { config } from "../config";
import { migrationSource } from "./migrations";
import { seedShopTypes } from "./seed";

export const db: Knex = knexFactory({ client: "pg", connection: config.DATABASE_URL, pool: { min: 0, max: 10 } });

export async function migrate() {
  const [, applied] = await db.migrate.latest({ migrationSource });
  if (applied.length) console.log(`[shop-service] migraciones aplicadas: ${applied.join(", ")}`);
  await seedShopTypes(db);
}
