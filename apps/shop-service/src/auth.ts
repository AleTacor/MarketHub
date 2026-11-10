import type { RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { AUTH_COOKIE, JWT_ISSUER, ROLES, type Role, type User } from "@markethub/shared";
import { config } from "./config";
import { HttpError } from "./errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** auth-service's public keys. Fetched lazily, cached, and refetched when an unknown kid appears. */
export const remoteKeys = (): JWTVerifyGetKey => createRemoteJWKSet(new URL(config.AUTH_JWKS_URL));

export type Auth = ReturnType<typeof createAuth>;

/** Auth middlewares that verify the session cookie against `getKey`. */
export function createAuth(getKey: JWTVerifyGetKey) {
  /** Verifies the session cookie and sets req.user. Rejects with 401 if missing/invalid. */
  const requireAuth: RequestHandler = async (req, _res, next) => {
    const token: string | undefined = req.cookies?.[AUTH_COOKIE];
    if (!token) throw new HttpError(401, "No has iniciado sesión");
    try {
      const { payload } = await jwtVerify(token, getKey, { issuer: JWT_ISSUER, algorithms: ["RS256"] });
      const role = payload.role as Role;
      if (!ROLES.includes(role)) throw new Error("bad role");
      req.user = { id: Number(payload.sub), name: String(payload.name), role };
    } catch {
      throw new HttpError(401, "Sesión no válida o caducada");
    }
    next();
  };

  const requireRole =
    (role: Role): RequestHandler =>
    (req, _res, next) => {
      if (req.user?.role !== role) throw new HttpError(403, "No tienes permiso para realizar esta acción");
      next();
    };

  return { requireAuth, requireRole, requireBusiness: [requireAuth, requireRole("empresario")] as RequestHandler[] };
}
