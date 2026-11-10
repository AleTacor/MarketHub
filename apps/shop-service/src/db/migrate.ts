import { db, migrate } from "./index";

await migrate();
await db.destroy();
