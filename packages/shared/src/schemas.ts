import { z } from "zod";
import { ROLES } from "./constants";

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
export const shopInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(100),
  description: z.string().trim().max(1000).default(""),
  postalCode: postalCodeSchema,
  shopTypeId: z.coerce.number({ invalid_type_error: "Selecciona un tipo de tienda" }).int().positive("Selecciona un tipo de tienda"),
  // Rough bounding box of Spain, Canary Islands included.
  lat: z.coerce.number().min(27, "Ubicación fuera de España").max(44, "Ubicación fuera de España"),
  lng: z.coerce.number().min(-19, "Ubicación fuera de España").max(5, "Ubicación fuera de España"),
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
  name: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  description: z.string().trim().max(1000).default(""),
  // Multipart sends an empty field (or none) when no quantity is given. Map that to
  // null before coercion, which would turn "" into 0.
  stock: z.preprocess((v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? null : v), optionalStockSchema),
});
export type ProductInput = z.infer<typeof productInputSchema>;

// JSON body: `{ stock: null }` removes the quantity; a missing `stock` is an error.
export const stockUpdateSchema = z.object({ stock: optionalStockSchema });

export const shopQuerySchema = z
  .object({
    postalCode: postalCodeSchema.optional(),
    q: z.string().trim().max(100).optional(),
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
