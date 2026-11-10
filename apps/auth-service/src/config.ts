import { z } from "zod";

export const config = z
  .object({
    PORT: z.coerce.number().default(4001),
    DATABASE_URL: z.string().default("postgres://markethub:markethub@localhost:5432/auth_db"),
    /** Where the generated RS256 key is stored when JWT_PRIVATE_KEY is not set. */
    KEYS_DIR: z.string().default("./.keys"),
    JWT_PRIVATE_KEY: z.string().optional(),
    /** bcrypt cost factor. Tests lower it to stay fast. */
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
    TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .parse(process.env);
