import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { calculateJwkThumbprint, exportJWK, exportPKCS8, generateKeyPair, importPKCS8, type JWK } from "jose";
import { config } from "./config";

export interface SigningKeys {
  privateKey: Awaited<ReturnType<typeof importPKCS8>>;
  /** Public half, published at /api/auth/.well-known/jwks.json */
  publicJwk: JWK;
}

async function loadPem(): Promise<string> {
  if (config.JWT_PRIVATE_KEY) return config.JWT_PRIVATE_KEY.replace(/\\n/g, "\n");
  const file = path.join(config.KEYS_DIR, "jwt-private.pem");
  try {
    return await readFile(file, "utf8");
  } catch {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    const pem = await exportPKCS8(privateKey);
    await mkdir(config.KEYS_DIR, { recursive: true });
    await writeFile(file, pem, { mode: 0o600 });
    console.log(`[auth-service] clave JWT generada en ${file}`);
    return pem;
  }
}

export async function loadSigningKeys(): Promise<SigningKeys> {
  const privateKey = await importPKCS8(await loadPem(), "RS256", { extractable: true });
  const { kty, n, e } = await exportJWK(privateKey);
  const publicJwk: JWK = { kty, n, e };
  publicJwk.kid = await calculateJwkThumbprint(publicJwk);
  return { privateKey, publicJwk: { ...publicJwk, alg: "RS256", use: "sig" } };
}
