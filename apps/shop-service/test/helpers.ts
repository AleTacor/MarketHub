import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { vi, type Mock } from "vitest";
import { AUTH_COOKIE, JWT_ISSUER, type Role, type ShopDetail } from "@markethub/shared";
import { createApp } from "../src/app";
import type { Geocoder } from "../src/geocoder";
import type { Repository } from "../src/repository";

type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

export type RepoMock = { [K in keyof Repository]: Mock };

/** Repository with every method mocked; defaults describe an empty DB. */
export function fakeRepo(): RepoMock {
  return {
    listShopTypes: vi.fn(async () => [{ id: 1, name: "Panadería y pastelería" }]),
    searchShops: vi.fn(async () => []),
    getShop: vi.fn(async () => null),
    getShopOwner: vi.fn(async () => undefined),
    createShop: vi.fn(async () => 1),
    updateShop: vi.fn(async () => undefined),
    deleteShop: vi.fn(async () => []),
    shopTypeExists: vi.fn(async () => true),
    getProductWithOwner: vi.fn(async () => undefined),
    createProduct: vi.fn(async (shopId: number, input: object, imageUrl: string | null) => ({ id: 1, shopId, imageUrl, ...input })),
    updateProduct: vi.fn(async (id: number, input: object) => ({ id, shopId: 1, imageUrl: null, ...input })),
    setStock: vi.fn(async (id: number, stock: number | null) => ({ id, shopId: 1, name: "Pan", description: "", imageUrl: null, stock })),
    deleteProduct: vi.fn(async () => 1),
  };
}

/** A key pair standing in for auth-service, plus a token factory. */
export async function createIssuer() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256" };
  const getKey = createLocalJWKSet({ keys: [jwk] });

  const sign = (
    claims: { sub?: string; name?: string; role?: string },
    { issuer = JWT_ISSUER, expiresIn = "1h", key = privateKey }: { issuer?: string; expiresIn?: string | number; key?: SigningKey } = {},
  ) => {
    const { sub = "1", ...rest } = claims;
    return new SignJWT(rest).setProtectedHeader({ alg: "RS256", kid: "test-key" }).setSubject(sub).setIssuer(issuer).setIssuedAt().setExpirationTime(expiresIn).sign(key);
  };

  /** Cookie header for a user with the given id/role. */
  const cookie = async (userId: number, role: Role) => `${AUTH_COOKIE}=${await sign({ sub: String(userId), name: `user${userId}`, role })}`;

  return { getKey, sign, cookie };
}

export async function setup() {
  const repo = fakeRepo();
  const geocoder = { search: vi.fn<Geocoder["search"]>(async () => []) };
  const issuer = await createIssuer();
  const app = createApp({ repo: repo as unknown as Repository, getKey: issuer.getKey, geocoder });
  return { repo, geocoder, app, ...issuer };
}

export const OWNER_ID = 7;

export const sampleShop = (overrides: Partial<ShopDetail> = {}): ShopDetail => ({
  id: 1,
  ownerId: OWNER_ID,
  name: "Panadería Luna",
  description: "Pan de masa madre",
  postalCode: "28001",
  imageUrl: "/uploads/shop.png",
  shopType: { id: 1, name: "Panadería y pastelería" },
  lat: 40.42,
  lng: -3.7,
  products: [],
  ...overrides,
});

export const PNG = Buffer.from("89504e470d0a1a0a", "hex"); // content isn't inspected, only the MIME type

export const validShopFields = {
  name: "Panadería Luna",
  description: "Pan de masa madre",
  postalCode: "28001",
  shopTypeId: "1",
  lat: "40.42",
  lng: "-3.70",
};
