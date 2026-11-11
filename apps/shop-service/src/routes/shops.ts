import { Router, type Request } from "express";
import { z } from "zod";
import { areaSearchSchema, SEARCH_PAGE_SIZE, shopInputSchema, shopQuerySchema, type GeoPolygon, type ShopListResponse, type ShopSearchPage } from "@markethub/shared";
import type { Auth } from "../auth";
import { HttpError } from "../errors";
import type { Repository } from "../repository";
import { deleteImage, imageUpload, saveImage } from "../storage";

export const idParam = z.coerce.number({ invalid_type_error: "Identificador no válido" }).int().positive("Identificador no válido");

/** Loads the shop and checks that the current user owns it. */
export async function assertShopOwner(repo: Repository, req: Request, shopId: number) {
  const shop = await repo.getShopOwner(shopId);
  if (!shop) throw new HttpError(404, "Tienda no encontrada");
  if (shop.ownerId !== req.user!.id) throw new HttpError(403, "Esta tienda no es tuya");
  return shop;
}

export function shopsRouter(repo: Repository, { requireBusiness }: Auth) {
  const r = Router();

  r.get("/shop-types", async (_req, res) => {
    res.json({ shopTypes: await repo.listShopTypes() });
  });

  /** Runs one page of a search and says where the next one starts. */
  const searchPage = async (filters: { postalCode?: string; q?: string; area?: GeoPolygon }, offset: number) => {
    const { shops, total } = await repo.searchShopsPage(filters, { offset, limit: SEARCH_PAGE_SIZE });
    const next = offset + shops.length;
    const body: ShopSearchPage = { shops, total, nextOffset: shops.length > 0 && next < total ? next : null };
    return body;
  };

  // List by postal code and/or name, a page at a time.
  r.get("/shops", async (req, res) => {
    const { offset, ...filters } = shopQuerySchema.parse(req.query);
    res.json(await searchPage(filters, offset));
  });

  // Shops whose location falls inside the polygon drawn on the map (location only, no postal codes).
  r.post("/shops/search-area", async (req, res) => {
    const parsed = areaSearchSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      // Polygon errors are too technical to show; the rest (offset) have Spanish messages.
      throw new HttpError(400, issue.path[0] === "area" ? "La zona seleccionada en el mapa no es válida" : issue.message);
    }
    const { area, q, offset } = parsed.data;
    res.json(await searchPage({ area, q }, offset));
  });

  r.get("/shops/mine", ...requireBusiness, async (req, res) => {
    const body: ShopListResponse = { shops: await repo.searchShops({ ownerId: req.user!.id }) };
    res.json(body);
  });

  r.get("/shops/:id", async (req, res) => {
    const shop = await repo.getShop(idParam.parse(req.params.id));
    if (!shop) throw new HttpError(404, "Tienda no encontrada");
    res.json(shop);
  });

  r.post("/shops", ...requireBusiness, imageUpload, async (req, res) => {
    const input = shopInputSchema.parse(req.body);
    if (!req.file) throw new HttpError(400, "La imagen de la tienda es obligatoria");
    if (!(await repo.shopTypeExists(input.shopTypeId))) throw new HttpError(400, "El tipo de tienda no existe");
    const imageUrl = await saveImage(req.file);
    const id = await repo.createShop(req.user!.id, input, imageUrl);
    res.status(201).json(await repo.getShop(id));
  });

  r.put("/shops/:id", ...requireBusiness, imageUpload, async (req, res) => {
    const id = idParam.parse(req.params.id);
    const current = await assertShopOwner(repo, req, id);
    const input = shopInputSchema.parse(req.body);
    if (!(await repo.shopTypeExists(input.shopTypeId))) throw new HttpError(400, "El tipo de tienda no existe");
    const imageUrl = req.file ? await saveImage(req.file) : undefined;
    await repo.updateShop(id, input, imageUrl);
    if (imageUrl) await deleteImage(current.imageUrl);
    res.json(await repo.getShop(id));
  });

  r.delete("/shops/:id", ...requireBusiness, async (req, res) => {
    const id = idParam.parse(req.params.id);
    await assertShopOwner(repo, req, id);
    const images = await repo.deleteShop(id);
    await Promise.all(images.map(deleteImage));
    res.status(204).end();
  });

  return r;
}
