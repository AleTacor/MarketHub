import { createApp } from "./app";
import { config } from "./config";
import { db, migrate } from "./db";
import { loadSigningKeys } from "./keys";
import { createUsersRepository } from "./users";

await migrate();
const keys = await loadSigningKeys();
createApp({ users: createUsersRepository(db), keys }).listen(config.PORT, () => {
  console.log(`[auth-service] escuchando en :${config.PORT}`);
});
