import { Router, type Request } from "express";
import { z } from "zod";
import { areaSearchSchema, shopInputSchema, shopQuerySchema, type ShopListResponse } from "@markethub/shared";
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

  // List by postal code and/or name.
  r.get("/shops", async (req, res) => {
    const filters = shopQuerySchema.parse(req.query);
    const body: ShopListResponse = { shops: await repo.searchShops(filters) };
    res.json(body);
  });

  // Shops whose location falls inside the polygon drawn on the map (location only, no postal codes).
  r.post("/shops/search-area", async (req, res) => {
    const parsed = areaSearchSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "La zona seleccionada en el mapa no es válida");
    const { area, q } = parsed.data;
    const body: ShopListResponse = { shops: await repo.searchShops({ area, q }) };
    res.json(body);
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
