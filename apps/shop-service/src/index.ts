import { createApp } from "./app";
import { remoteKeys } from "./auth";
import { config } from "./config";
import { db, migrate } from "./db";
import { createRepository } from "./repository";

await migrate();
createApp({ repo: createRepository(db), getKey: remoteKeys() }).listen(config.PORT, () => {
  console.log(`[shop-service] escuchando en :${config.PORT}`);
});
