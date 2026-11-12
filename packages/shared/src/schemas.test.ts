import { describe, expect, it } from "vitest";
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from "./constants";
import { areaSearchSchema, phonesSchema, postalCodeSchema, reviewLinksSchema, productInputSchema, registerSchema, shopInputSchema, stockUpdateSchema } from "./schemas";

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

describe("name and description limits", () => {
  const message = (schema: typeof productInputSchema | typeof shopInputSchema, input: object) =>
    schema.safeParse(input).error?.issues[0]?.message;
  const shop = { postalCode: "28001", shopTypeId: "1", lat: "40.4", lng: "-3.7" };

  it.each([
    ["product", productInputSchema, {}],
    ["shop", shopInputSchema, shop],
  ] as const)("rejects a too long %s name or description in Spanish", (_label, schema, rest) => {
    expect(message(schema, { ...rest, name: "x".repeat(NAME_MAX_LENGTH + 1) })).toBe("El nombre no puede superar los 100 caracteres");
    expect(message(schema, { ...rest, name: "Pan", description: "x".repeat(DESCRIPTION_MAX_LENGTH + 1) })).toBe(
      "La descripción no puede superar los 1000 caracteres",
    );
    expect(schema.safeParse({ ...rest, name: "x".repeat(NAME_MAX_LENGTH), description: "x".repeat(DESCRIPTION_MAX_LENGTH) }).success).toBe(true);
  });
});

describe("reviewLinksSchema", () => {
  const error = (input: object) => reviewLinksSchema.safeParse(input).error?.issues[0]?.message;

  it("accepts links to each platform's own domains, subdomains included", () => {
    expect(
      reviewLinksSchema.parse({
        google: "https://maps.app.goo.gl/AbC123",
        tripadvisor: "https://www.tripadvisor.es/Restaurant_Review-g187514-d1-Reviews.html",
        thefork: "https://www.eltenedor.es/restaurante/casa-luna-r1",
        trustpilot: "https://es.trustpilot.com/review/luna.es",
        facebook: "https://www.facebook.com/panaderialuna",
      }),
    ).toEqual({
      google: "https://maps.app.goo.gl/AbC123",
      tripadvisor: "https://www.tripadvisor.es/Restaurant_Review-g187514-d1-Reviews.html",
      thefork: "https://www.eltenedor.es/restaurante/casa-luna-r1",
      trustpilot: "https://es.trustpilot.com/review/luna.es",
      facebook: "https://www.facebook.com/panaderialuna",
    });
  });

  it("drops empty fields, ignores unknown platforms and defaults to no links", () => {
    expect(reviewLinksSchema.parse({ google: "  ", tripadvisor: "", yelp: "https://www.yelp.es/x" })).toEqual({});
    expect(reviewLinksSchema.parse(undefined)).toEqual({});
  });

  it("completes a link pasted without https://", () => {
    expect(reviewLinksSchema.parse({ tripadvisor: " www.tripadvisor.es/Hotel_Review-x " })).toEqual({
      tripadvisor: "https://www.tripadvisor.es/Hotel_Review-x",
    });
  });

  it.each([
    ["another site", "https://www.yelp.es/biz/luna"],
    ["a look-alike domain", "https://tripadvisor.es.example.com/x"],
    ["a domain ending like it", "https://faketripadvisor.es/x"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["an ftp: URL", "ftp://www.tripadvisor.es/x"],
    ["something that isn't a URL", "no tengo"],
  ])("rejects %s with a Spanish message", (_label, url) => {
    expect(error({ tripadvisor: url })).toBe("El enlace de Tripadvisor debe ser una dirección de tripadvisor.es, tripadvisor.com");
  });

  it("limits the length", () => {
    expect(error({ google: `https://www.google.com/maps/${"x".repeat(500)}` })).toBe(
      "El enlace de Google Maps no puede superar los 500 caracteres",
    );
  });
});

describe("phonesSchema", () => {
  it.each([
    ["a landline with spaces", "91 123 45 67", "911234567"],
    ["a mobile with dots and dashes", "612.345-678", "612345678"],
    ["a +34 prefix", "+34 612 345 678", "612345678"],
    ["a 0034 prefix", "0034612345678", "612345678"],
    ["a free number", "900 123 456", "900123456"],
  ])("accepts %s and keeps the 9 digits", (_label, input, digits) => {
    expect(phonesSchema.parse([input])).toEqual([digits]);
  });

  it.each(["512345678", "12345678", "6123456789", "+33612345678", "teléfono"])("rejects %s in Spanish", (phone) => {
    expect(phonesSchema.safeParse([phone]).error?.issues[0]?.message).toBe(
      "Introduce un teléfono español válido (9 dígitos, p. ej. 912 345 678)",
    );
  });

  it("drops empty fields and repeated numbers, and accepts multipart shapes", () => {
    expect(phonesSchema.parse(["", "612345678", " ", "612 345 678"])).toEqual(["612345678"]);
    expect(phonesSchema.parse("912345678")).toEqual(["912345678"]);
    expect(phonesSchema.parse(undefined)).toEqual([]);
  });

  it("allows at most 3", () => {
    expect(phonesSchema.parse(["612345671", "612345672", "612345673"])).toHaveLength(3);
    expect(phonesSchema.safeParse(["612345671", "612345672", "612345673", "612345674"]).error?.issues[0]?.message).toBe(
      "Puedes añadir hasta 3 teléfonos",
    );
  });
});
