import { describe, expect, it } from "vitest";
import { areaSearchSchema, postalCodeSchema, registerSchema, shopInputSchema } from "./schemas";

describe("postalCodeSchema", () => {
  it.each(["28001", "08080", "01001", "52006", " 41001 "])("accepts %s", (cp) => {
    expect(postalCodeSchema.safeParse(cp).success).toBe(true);
  });
  it.each(["00123", "53000", "99999", "2800", "280011", "abcde"])("rejects %s", (cp) => {
    expect(postalCodeSchema.safeParse(cp).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("requires a known role", () => {
    expect(registerSchema.safeParse({ name: "pepe", password: "12345678", role: "admin" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "pepe", password: "12345678", role: "cliente" }).success).toBe(true);
  });
});

describe("shopInputSchema", () => {
  it("coerces multipart string fields", () => {
    const r = shopInputSchema.parse({ name: "Panadería Luna", postalCode: "28001", shopTypeId: "3", lat: "40.42", lng: "-3.70" });
    expect(r).toMatchObject({ shopTypeId: 3, lat: 40.42, lng: -3.7, description: "" });
  });
  it("rejects locations outside Spain", () => {
    expect(shopInputSchema.safeParse({ name: "X Shop", postalCode: "28001", shopTypeId: 1, lat: 48.85, lng: 2.35 }).success).toBe(false);
  });
});

describe("areaSearchSchema", () => {
  it("accepts a closed rectangle", () => {
    const ring = [[-3.8, 40.3], [-3.6, 40.3], [-3.6, 40.5], [-3.8, 40.5], [-3.8, 40.3]];
    expect(areaSearchSchema.safeParse({ area: { type: "Polygon", coordinates: [ring] } }).success).toBe(true);
  });
});
