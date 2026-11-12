import { z } from "zod";
import { DESCRIPTION_MAX_LENGTH, MAX_PHONES, NAME_MAX_LENGTH, REVIEW_PLATFORMS, REVIEW_URL_MAX_LENGTH, ROLES, type ReviewPlatform } from "./constants";

/** Spanish postal code: 5 digits, province prefix 01–52. */
export const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/, "Introduce un código postal español válido (5 dígitos)");

const nameField = z
  .string()
  .trim()
  .min(3, "El nombre debe tener al menos 3 caracteres")
  .max(50, "El nombre no puede superar los 50 caracteres");

export const registerSchema = z.object({
  name: nameField,
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña no puede superar los 128 caracteres"),
  role: z.enum(ROLES, { errorMap: () => ({ message: "Selecciona un tipo de usuario" }) }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  name: z.string().trim().min(1, "Introduce tu nombre de usuario"),
  password: z.string().min(1, "Introduce tu contraseña"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Shop fields. Sent as multipart/form-data (together with the image), so
 * numbers arrive as strings and are coerced.
 */
const nameMax = `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres`;
const descriptionField = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX_LENGTH, `La descripción no puede superar los ${DESCRIPTION_MAX_LENGTH} caracteres`)
  .default("");

type Platform = (typeof REVIEW_PLATFORMS)[number];

const matchesHost = (host: string, domains: readonly string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`));

/**
 * Optional link to the shop's page on one review site. Empty means no link. A
 * missing scheme is assumed to be https ("www.tripadvisor.es/..." as pasted).
 */
const reviewUrlField = (p: Platform) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const t = v.trim();
      if (!t) return undefined;
      return /^[a-z][a-z\d+.-]*:/i.test(t) ? t : `https://${t}`;
    },
    z
      .string()
      .max(REVIEW_URL_MAX_LENGTH, `El enlace de ${p.label} no puede superar los ${REVIEW_URL_MAX_LENGTH} caracteres`)
      .refine(
        (v) => {
          try {
            const url = new URL(v);
            return (url.protocol === "https:" || url.protocol === "http:") && matchesHost(url.hostname.toLowerCase(), p.hosts);
          } catch {
            return false;
          }
        },
        { message: `El enlace de ${p.label} debe ser una dirección de ${p.hosts.join(", ")}` },
      )
      .optional(),
  );

/** `{ google?: url, tripadvisor?: url, ... }`. Multipart fields `reviewLinks[<platform>]`. */
export const reviewLinksSchema = z
  .object(
    Object.fromEntries(REVIEW_PLATFORMS.map((p) => [p.id, reviewUrlField(p)])) as Record<ReviewPlatform, ReturnType<typeof reviewUrlField>>,
  )
  .default({});
export type ReviewLinks = Partial<Record<ReviewPlatform, string>>;

/**
 * Spanish phone number (landline, mobile, 800/900): 9 digits starting with 6–9,
 * optionally after +34 / 0034. Spaces, dots, dashes and parentheses are allowed
 * and stripped, so the result is the bare 9 digits.
 */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s.\-()]/g, "").replace(/^(\+|00)34(?=\d{9}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{8}$/, "Introduce un teléfono español válido (9 dígitos, p. ej. 912 345 678)"));

/**
 * Up to MAX_PHONES numbers. Multipart fields `phones[0]`, `phones[1]`, ... (multer
 * nests them into an array); empty fields are dropped and repeated numbers kept once.
 */
export const phonesSchema = z
  .preprocess(
    (v) => {
      if (v === undefined || v === null) return [];
      const list = Array.isArray(v) ? v : typeof v === "object" ? Object.values(v) : [v];
      return list.filter((p) => !(typeof p === "string" && p.trim() === ""));
    },
    z.array(phoneSchema).max(MAX_PHONES, `Puedes añadir hasta ${MAX_PHONES} teléfonos`),
  )
  .transform((phones) => [...new Set(phones)]);

export const shopInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(NAME_MAX_LENGTH, nameMax),
  description: descriptionField,
  postalCode: postalCodeSchema,
  shopTypeId: z.coerce.number({ invalid_type_error: "Selecciona un tipo de tienda" }).int().positive("Selecciona un tipo de tienda"),
  // Rough bounding box of Spain, Canary Islands included.
  lat: z.coerce.number().min(27, "Ubicación fuera de España").max(44, "Ubicación fuera de España"),
  lng: z.coerce.number().min(-19, "Ubicación fuera de España").max(5, "Ubicación fuera de España"),
  reviewLinks: reviewLinksSchema,
  phones: phonesSchema,
});
export type ShopInput = z.infer<typeof shopInputSchema>;

export const stockSchema = z.coerce
  .number({ invalid_type_error: "La cantidad debe ser un número" })
  .int("La cantidad debe ser un número entero")
  .min(0, "La cantidad no puede ser negativa")
  .max(1_000_000);

/** Optional stock: `null` means the quantity isn't tracked. */
const optionalStockSchema = stockSchema.nullable();

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(NAME_MAX_LENGTH, nameMax),
  description: descriptionField,
  // Multipart sends an empty field (or none) when no quantity is given. Map that to
  // null before coercion, which would turn "" into 0.
  stock: z.preprocess((v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v), optionalStockSchema),
});
export type ProductInput = z.infer<typeof productInputSchema>;

// JSON body: `{ stock: null }` removes the quantity; a missing `stock` is an error.
export const stockUpdateSchema = z.object({ stock: optionalStockSchema });

/** Position of the first result of a page (pages have SEARCH_PAGE_SIZE shops). */
const offsetField = z.coerce
  .number({ invalid_type_error: "Página no válida" })
  .int("Página no válida")
  .min(0, "Página no válida")
  .max(10_000, "Página no válida")
  .default(0);

export const shopQuerySchema = z
  .object({
    postalCode: postalCodeSchema.optional(),
    q: z.string().trim().max(100).optional(),
    offset: offsetField,
  })
  .refine((v) => v.postalCode || v.q, { message: "Indica un código postal o un nombre" });

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

/** GeoJSON Polygon drawn on the map (rectangle or free polygon). */
export const geoPolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(position).min(4).max(500)).min(1).max(10),
});
export type GeoPolygon = z.infer<typeof geoPolygonSchema>;

export const areaSearchSchema = z.object({
  area: geoPolygonSchema,
  q: z.string().trim().max(100).optional(),
  offset: offsetField,
});
export type AreaSearchInput = z.infer<typeof areaSearchSchema>;

/** Address lookup for placing a shop (`GET /api/geocode?q=`). */
export const geocodeQuerySchema = z.object({
  q: z
    .string({ required_error: "Escribe una dirección", invalid_type_error: "Escribe una dirección" })
    .trim()
    .min(3, "Escribe una dirección más completa")
    .max(200, "La dirección no puede superar los 200 caracteres"),
});
