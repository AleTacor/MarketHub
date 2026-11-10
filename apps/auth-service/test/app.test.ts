import bcrypt from "bcryptjs";
import { createLocalJWKSet, decodeProtectedHeader, jwtVerify, SignJWT } from "jose";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AUTH_COOKIE, JWT_ISSUER } from "@markethub/shared";
import { createApp } from "../src/app";
import { loadSigningKeys, type SigningKeys } from "../src/keys";
import { memoryUsers, tokenFrom } from "./helpers";

let keys: SigningKeys;
let users: ReturnType<typeof memoryUsers>;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  keys = await loadSigningKeys();
});

beforeEach(() => {
  users = memoryUsers();
  app = createApp({ users, keys }); // fresh app = fresh rate limiter
});

const register = (body: object) => request(app).post("/api/auth/register").send(body);
const login = (body: object) => request(app).post("/api/auth/login").send(body);
const pepe = { name: "Pepe", password: "secreto123", role: "empresario" };

describe("POST /api/auth/register", () => {
  it("creates the user, returns it and sets an httpOnly session cookie", async () => {
    const res = await register(pepe).expect(201);

    expect(res.body).toEqual({ user: { id: 1, name: "Pepe", role: "empresario" } });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/^mh_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("stores a bcrypt hash, never the plain password", async () => {
    await register(pepe).expect(201);
    const stored = users.rows[0]!;
    expect(stored.passwordHash).not.toBe(pepe.password);
    expect(await bcrypt.compare(pepe.password, stored.passwordHash)).toBe(true);
  });

  it("does not leak the password hash in the response", async () => {
    const res = await register(pepe);
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("rejects a name taken with different casing", async () => {
    await register(pepe).expect(201);
    const res = await register({ ...pepe, name: "PEPE" }).expect(409);
    expect(res.body.error).toBe("Ese nombre de usuario ya está registrado");
  });

  it.each([
    [{ ...pepe, name: "ab" }, "El nombre debe tener al menos 3 caracteres"],
    [{ ...pepe, password: "corta" }, "La contraseña debe tener al menos 8 caracteres"],
    [{ ...pepe, role: "admin" }, "Selecciona un tipo de usuario"],
    [{ name: "Pepe" }, undefined],
  ])("validates the body %#", async (body, message) => {
    const res = await register(body).expect(400);
    expect(res.body.error).toEqual(message ?? expect.any(String));
    expect(users.rows).toHaveLength(0);
  });

  it("answers malformed JSON with 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);
    expect(res.body.error).toBe("JSON no válido");
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await register(pepe).expect(201);
  });

  it("logs in with the right password (name is case-insensitive)", async () => {
    const res = await login({ name: "pepe", password: pepe.password }).expect(200);
    expect(res.body.user).toEqual({ id: 1, name: "Pepe", role: "empresario" });
    expect(tokenFrom(res.headers["set-cookie"])).toBeDefined();
  });

  it("gives the same 401 for a wrong password and an unknown user", async () => {
    const wrong = await login({ name: "Pepe", password: "otra-clave" }).expect(401);
    const unknown = await login({ name: "Nadie", password: "otra-clave" }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error).toBe("Usuario o contraseña incorrectos");
    expect(wrong.headers["set-cookie"]).toBeUndefined();
  });

  it("requires both fields", async () => {
    await login({ name: "Pepe" }).expect(400);
  });

  it("rate-limits repeated attempts", async () => {
    // The limiter is shared by register+login: 1 register in beforeEach + 29 logins = 30 allowed.
    for (let i = 0; i < 29; i++) await login({ name: "Pepe", password: "x" });
    const res = await login({ name: "Pepe", password: pepe.password }).expect(429);
    expect(res.body.error).toMatch(/Demasiados intentos/);
  });
});

describe("session token", () => {
  it("is an RS256 JWT with the user claims, verifiable with the published JWKS", async () => {
    const token = tokenFrom((await register(pepe)).headers["set-cookie"])!;
    const jwks = await request(app).get("/api/auth/.well-known/jwks.json").expect(200);

    const header = decodeProtectedHeader(token);
    expect(header).toMatchObject({ alg: "RS256", kid: jwks.body.keys[0].kid });

    const { payload } = await jwtVerify(token, createLocalJWKSet(jwks.body), { issuer: JWT_ISSUER });
    expect(payload).toMatchObject({ sub: "1", name: "Pepe", role: "empresario" });
    expect(payload.exp! - payload.iat!).toBe(7 * 24 * 60 * 60);
  });
});

describe("GET /api/auth/me", () => {
  const me = (token?: string) => {
    const req = request(app).get("/api/auth/me");
    return token ? req.set("Cookie", `${AUTH_COOKIE}=${token}`) : req;
  };

  it("returns the current user", async () => {
    const token = tokenFrom((await register(pepe)).headers["set-cookie"]);
    const res = await me(token).expect(200);
    expect(res.body).toEqual({ user: { id: 1, name: "Pepe", role: "empresario" } });
  });

  it("returns 401 without a cookie", async () => {
    const res = await me().expect(401);
    expect(res.body.error).toBe("No has iniciado sesión");
  });

  it("rejects a tampered token", async () => {
    const token = tokenFrom((await register(pepe)).headers["set-cookie"])!;
    const [h, p, s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "1", role: "empresario", iss: JWT_ISSUER })).toString("base64url");
    await me(`${h}.${forgedPayload}.${s}`).expect(401);
    await me(`${h}.${p}.${s}x`).expect(401);
  });

  it("rejects an expired token", async () => {
    await register(pepe);
    const expired = await new SignJWT({ name: "Pepe", role: "empresario" })
      .setProtectedHeader({ alg: "RS256", kid: keys.publicJwk.kid })
      .setSubject("1")
      .setIssuer(JWT_ISSUER)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(keys.privateKey);
    await me(expired).expect(401);
  });

  it("rejects a valid token whose user no longer exists", async () => {
    const token = tokenFrom((await register(pepe)).headers["set-cookie"]);
    users.rows.length = 0;
    await me(token).expect(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session cookie", async () => {
    const res = await request(app).post("/api/auth/logout").expect(204);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/^mh_token=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe("GET /api/auth/.well-known/jwks.json", () => {
  it("publishes only the public key", async () => {
    const res = await request(app).get("/api/auth/.well-known/jwks.json").expect(200);
    expect(res.body.keys).toHaveLength(1);
    const [key] = res.body.keys;
    expect(key).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig" });
    expect(Object.keys(key).sort()).toEqual(["alg", "e", "kid", "kty", "n", "use"]);
  });
});

describe("misc", () => {
  it("has a health endpoint", async () => {
    await request(app).get("/health").expect(200, { ok: true });
  });

  it("answers unknown routes with a JSON 404", async () => {
    await request(app).get("/api/auth/nope").expect(404, { error: "No encontrado" });
  });
});
