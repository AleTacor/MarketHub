import { createApp } from "./app";
import { remoteKeys } from "./auth";
import { config } from "./config";
import { db, migrate } from "./db";
import { createGeocoder } from "./geocoder";
import { createRepository } from "./repository";

await migrate();
const geocoder = createGeocoder({
  nominatimUrl: config.GEOCODER_URL,
  cartoCiudadUrl: config.CARTOCIUDAD_URL,
  userAgent: config.GEOCODER_USER_AGENT,
});
createApp({ repo: createRepository(db), getKey: remoteKeys(), geocoder }).listen(config.PORT, () => {
  console.log(`[shop-service] escuchando en :${config.PORT}`);
});
