import { Router, type Request } from "express";
import { productInputSchema, stockUpdateSchema } from "@markethub/shared";
import type { Auth } from "../auth";
import { HttpError } from "../errors";
import type { Repository } from "../repository";
import { deleteImage, imageUpload, saveImage } from "../storage";
import { assertShopOwner, idParam } from "./shops";

export function productsRouter(repo: Repository, { requireBusiness }: Auth) {
  const r = Router();

  async function assertProductOwner(req: Request) {
    const product = await repo.getProductWithOwner(idParam.parse(req.params.id));
    if (!product) throw new HttpError(404, "Producto no encontrado");
    if (product.ownerId !== req.user!.id) throw new HttpError(403, "Este producto no es tuyo");
    return product;
  }

  r.post("/shops/:id/products", ...requireBusiness, imageUpload, async (req, res) => {
    const shopId = idParam.parse(req.params.id);
    await assertShopOwner(repo, req, shopId);
    const input = productInputSchema.parse(req.body);
    const imageUrl = req.file ? await saveImage(req.file) : null;
    res.status(201).json(await repo.createProduct(shopId, input, imageUrl));
  });

  r.put("/products/:id", ...requireBusiness, imageUpload, async (req, res) => {
    const current = await assertProductOwner(req);
    const input = productInputSchema.parse(req.body);
    const imageUrl = req.file ? await saveImage(req.file) : undefined;
    const product = await repo.updateProduct(current.id, input, imageUrl);
    if (imageUrl) await deleteImage(current.imageUrl);
    res.json(product);
  });

  // Quick stock change from the product list (no edit form).
  r.patch("/products/:id/stock", ...requireBusiness, async (req, res) => {
    const { stock } = stockUpdateSchema.parse(req.body);
    const current = await assertProductOwner(req);
    res.json(await repo.setStock(current.id, stock));
  });

  r.delete("/products/:id", ...requireBusiness, async (req, res) => {
    const current = await assertProductOwner(req);
    await repo.deleteProduct(current.id);
    await deleteImage(current.imageUrl);
    res.status(204).end();
  });

  return r;
}
