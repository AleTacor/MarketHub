import { generateKeyPair } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { AUTH_COOKIE } from "@markethub/shared";
import { OWNER_ID, setup } from "./helpers";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  ctx = await setup();
});

// /api/shops/mine needs a valid session with the empresario role.
const mine = (cookie?: string) => {
  const req = request(ctx.app).get("/api/shops/mine");
  return cookie ? req.set("Cookie", cookie) : req;
};

describe("session verification", () => {
  it("lets a valid empresario token through and exposes the user id", async () => {
    await mine(await ctx.cookie(OWNER_ID, "empresario")).expect(200, { shops: [] });
    expect(ctx.repo.searchShops).toHaveBeenCalledWith({ ownerId: OWNER_ID });
  });

  it("returns 401 without a cookie", async () => {
    const res = await mine().expect(401);
    expect(res.body.error).toBe("No has iniciado sesión");
  });

  it("returns 403 for a cliente", async () => {
    const res = await mine(await ctx.cookie(1, "cliente")).expect(403);
    expect(res.body.error).toBe("No tienes permiso para realizar esta acción");
    expect(ctx.repo.searchShops).not.toHaveBeenCalled();
  });

  it.each([
    ["garbage", async () => "not-a-jwt"],
    ["expired", async () => ctx.sign({ role: "empresario" }, { expiresIn: Math.floor(Date.now() / 1000) - 10 })],
    ["wrong issuer", async () => ctx.sign({ role: "empresario" }, { issuer: "someone-else" })],
    ["signed with another key", async () => ctx.sign({ role: "empresario" }, { key: (await generateKeyPair("RS256")).privateKey })],
    ["unknown role", async () => ctx.sign({ role: "admin" })],
  ])("rejects a %s token with 401", async (_label, makeToken) => {
    const res = await mine(`${AUTH_COOKIE}=${await makeToken()}`).expect(401);
    expect(res.body.error).toBe("Sesión no válida o caducada");
  });
});
