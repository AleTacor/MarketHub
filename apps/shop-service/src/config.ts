import { z } from "zod";

export const config = z
  .object({
    PORT: z.coerce.number().default(4002),
    DATABASE_URL: z.string().default("postgres://markethub:markethub@localhost:5432/shop_db"),
    AUTH_JWKS_URL: z.string().url().default("http://localhost:4001/api/auth/.well-known/jwks.json"),
    /** Directory where uploaded images are written (served by nginx). */
    UPLOAD_DIR: z.string().default("./uploads"),
    /** URL prefix under which nginx serves UPLOAD_DIR. */
    PUBLIC_UPLOAD_PATH: z.string().default("/uploads"),
  })
  .parse(process.env);
