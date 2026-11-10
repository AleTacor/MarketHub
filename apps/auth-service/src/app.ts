import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import express, { type CookieOptions } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createLocalJWKSet, jwtVerify, SignJWT } from "jose";
import { AUTH_COOKIE, JWT_ISSUER, loginSchema, registerSchema, type User } from "@markethub/shared";
import { config } from "./config";
import { errorHandler, HttpError } from "./errors";
import type { SigningKeys } from "./keys";
import { DuplicateUserError, type UserRow, type UsersRepository } from "./users";

const toUser = (row: UserRow): User => ({ id: row.id, name: row.name, role: row.role });

// Used when the user doesn't exist, so login takes the same time either way.
const DUMMY_HASH = bcrypt.hashSync("markethub-dummy-password", config.BCRYPT_ROUNDS);

export function createApp({ users, keys }: { users: UsersRepository; keys: SigningKeys }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // behind nginx
  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  const jwks = createLocalJWKSet({ keys: [keys.publicJwk] });
  const ttlSeconds = config.TOKEN_TTL_DAYS * 24 * 60 * 60;
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: config.COOKIE_SECURE,
    path: "/",
  };

  const signToken = (user: User) =>
    new SignJWT({ name: user.name, role: user.role })
      .setProtectedHeader({ alg: "RS256", kid: keys.publicJwk.kid })
      .setSubject(String(user.id))
      .setIssuer(JWT_ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(keys.privateKey);

  const sendSession = async (res: express.Response, user: User, status = 200) => {
    res.cookie(AUTH_COOKIE, await signToken(user), { ...cookieOptions, maxAge: ttlSeconds * 1000 });
    res.status(status).json({ user });
  };

  const credentialsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Inténtalo de nuevo más tarde." },
  });

  const router = express.Router();

  router.post("/register", credentialsLimiter, async (req, res) => {
    const input = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(input.password, config.BCRYPT_ROUNDS);
    let row: UserRow;
    try {
      row = await users.create({ name: input.name, role: input.role, passwordHash });
    } catch (err) {
      if (err instanceof DuplicateUserError) throw new HttpError(409, "Ese nombre de usuario ya está registrado");
      throw err;
    }
    await sendSession(res, toUser(row), 201);
  });

  router.post("/login", credentialsLimiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const row = await users.findByName(input.name);
    const ok = await bcrypt.compare(input.password, row?.passwordHash ?? DUMMY_HASH);
    if (!row || !ok) throw new HttpError(401, "Usuario o contraseña incorrectos");
    await sendSession(res, toUser(row));
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie(AUTH_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.get("/me", async (req, res) => {
    const token: string | undefined = req.cookies?.[AUTH_COOKIE];
    if (!token) throw new HttpError(401, "No has iniciado sesión");
    let userId: number;
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer: JWT_ISSUER });
      userId = Number(payload.sub);
    } catch {
      throw new HttpError(401, "Sesión no válida o caducada");
    }
    const row = await users.findById(userId);
    if (!row) throw new HttpError(401, "Sesión no válida o caducada");
    res.json({ user: toUser(row) });
  });

  // Public key used by shop-service to verify tokens.
  router.get("/.well-known/jwks.json", (_req, res) => {
    res.set("Cache-Control", "public, max-age=300").json({ keys: [keys.publicJwk] });
  });

  app.use("/api/auth", router);
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "No encontrado" });
  });
  app.use(errorHandler);
  return app;
}
