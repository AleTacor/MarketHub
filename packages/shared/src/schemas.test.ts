import { describe, expect, it } from "vitest";
import { areaSearchSchema, postalCodeSchema, productInputSchema, registerSchema, shopInputSchema, stockUpdateSchema } from "./schemas";

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

describe("productInputSchema stock", () => {
  const stockOf = (stock: unknown) => productInputSchema.parse({ name: "Pan", stock }).stock;

  it("coerces multipart strings, keeping 0", () => {
    expect(stockOf("12")).toBe(12);
    expect(stockOf("0")).toBe(0);
  });

  it("treats an empty or missing quantity as not tracked (null), not 0", () => {
    expect(stockOf("")).toBeNull();
    expect(stockOf("  ")).toBeNull();
    expect(stockOf(undefined)).toBeNull();
  });

  it("still rejects invalid quantities", () => {
    expect(productInputSchema.safeParse({ name: "Pan", stock: "-1" }).success).toBe(false);
    expect(productInputSchema.safeParse({ name: "Pan", stock: "abc" }).success).toBe(false);
  });
});

describe("stockUpdateSchema", () => {
  it("accepts null to remove the quantity, but requires the field", () => {
    expect(stockUpdateSchema.parse({ stock: null })).toEqual({ stock: null });
    expect(stockUpdateSchema.safeParse({}).success).toBe(false);
  });
});
