import { readdir } from "node:fs/promises";
import { exportPKCS8, generateKeyPair } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";

// config.ts reads process.env at import time, so each test re-imports the module.
async function importKeys() {
  vi.resetModules();
  return import("../src/keys");
}

afterEach(() => {
  delete process.env.JWT_PRIVATE_KEY;
});

describe("loadSigningKeys", () => {
  it("generates a key on first start and reuses it afterwards", async () => {
    const { loadSigningKeys } = await importKeys();
    const first = await loadSigningKeys();
    expect(await readdir(process.env.KEYS_DIR!)).toContain("jwt-private.pem");

    const second = await (await importKeys()).loadSigningKeys();
    expect(second.publicJwk.kid).toBe(first.publicJwk.kid);
  });

  it("uses JWT_PRIVATE_KEY when set, accepting \\n-escaped PEM", async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    const pem = await exportPKCS8(privateKey);
    process.env.JWT_PRIVATE_KEY = pem.replace(/\n/g, "\\n");

    const fromEnv = await (await importKeys()).loadSigningKeys();
    delete process.env.JWT_PRIVATE_KEY;
    const fromFile = await (await importKeys()).loadSigningKeys();

    expect(fromEnv.publicJwk.kid).not.toBe(fromFile.publicJwk.kid);
  });

  it("exposes only public fields in the JWK", async () => {
    const { publicJwk } = await (await importKeys()).loadSigningKeys();
    for (const secret of ["d", "p", "q", "dp", "dq", "qi"]) expect(publicJwk).not.toHaveProperty(secret);
  });
});
