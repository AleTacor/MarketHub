import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import type { JWTVerifyGetKey } from "jose";
import { createAuth } from "./auth";
import { config } from "./config";
import { errorHandler } from "./errors";
import type { Geocoder } from "./geocoder";
import type { Repository } from "./repository";
import { geocodeRouter } from "./routes/geocode";
import { productsRouter } from "./routes/products";
import { shopsRouter } from "./routes/shops";

/** Dependencies are injected so tests can use fakes and a local key pair. */
export function createApp({ repo, getKey, geocoder }: { repo: Repository; getKey: JWTVerifyGetKey; geocoder: Geocoder }) {
  const auth = createAuth(getKey);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind nginx
  app.use(helmet());
  app.use(express.json({ limit: "200kb" })); // polygons can have many points
  app.use(cookieParser());

  app.use("/api", shopsRouter(repo, auth), productsRouter(repo, auth), geocodeRouter(geocoder, auth));
  // In Docker nginx serves this path directly; this covers `pnpm dev` without nginx.
  app.use(config.PUBLIC_UPLOAD_PATH, express.static(config.UPLOAD_DIR, { maxAge: "7d" }));
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "No encontrado" });
  });
  app.use(errorHandler);
  return app;
}
