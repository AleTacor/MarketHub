import type { Knex } from "knex";

/**
 * Business types offered when creating a shop (the UI says "negocio"). The DB table is the source of
 * truth; this list only seeds it (idempotent, runs on every startup).
 * To add a type, append it here or insert it directly into `shop_types`.
 */
export const SHOP_TYPES = [
  "Alimentación",
  "Panadería y pastelería",
  "Carnicería",
  "Pescadería",
  "Frutería",
  "Restaurante",
  "Farmacia",
  "Droguería y perfumería",
  "Ropa",
  "Calzado",
  "Electrónica",
  "Ferretería",
  "Librería y papelería",
  "Floristería",
  "Juguetería",
  "Deportes",
  "Mascotas",
  "Hogar y decoración",
  // Businesses people look for nearby (services too, not only shops). Left out on
  // purpose: lodging and travel, found elsewhere, and trades with no premises.
  "Ocio y entretenimiento",
  "Bar y cafetería",
  "Clínica y centro médico",
  "Dentista",
  "Fisioterapia",
  "Óptica",
  "Veterinario",
  "Peluquería y barbería",
  "Estética y uñas",
  "Gimnasio",
  "Concesionario",
  "Taller mecánico",
  "Academia y clases",
  "Abogados",
  "Gestoría y asesoría",
  "Inmobiliaria",
  "Tintorería y lavandería",
  "Arreglos de ropa y calzado",
  "Reparación de móviles e informática",
  "Copistería e imprenta",
  "Estanco",
  "Joyería y relojería",
  "Herbolario",
  "Otros",
];

export async function seedShopTypes(db: Knex) {
  await db("shop_types")
    .insert(SHOP_TYPES.map((name) => ({ name })))
    .onConflict("name")
    .ignore();
}
