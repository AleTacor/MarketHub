import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { OWNER_ID, PNG, setup } from "./helpers";

const UPLOAD_DIR = process.env.UPLOAD_DIR!;
let ctx: Awaited<ReturnType<typeof setup>>;
let owner: string;

beforeEach(async () => {
  ctx = await setup();
  owner = await ctx.cookie(OWNER_ID, "empresario");
});

const ownProduct = { id: 5, shopId: 1, ownerId: OWNER_ID, imageUrl: null };
const othersProduct = { ...ownProduct, ownerId: 999 };

describe("POST /api/shops/:id/products", () => {
  beforeEach(() => {
    ctx.repo.getShopOwner.mockResolvedValue({ ownerId: OWNER_ID, imageUrl: "/uploads/s.png" });
  });

  it("creates a product without image, defaulting description", async () => {
    const res = await request(ctx.app)
      .post("/api/shops/1/products")
      .set("Cookie", owner)
      .field({ name: "Barra de pan", stock: "12" })
      .expect(201);
    expect(ctx.repo.createProduct).toHaveBeenCalledWith(1, { name: "Barra de pan", description: "", stock: 12 }, null);
    expect(res.body).toMatchObject({ name: "Barra de pan", stock: 12 });
  });

  it.each([
    ["an empty quantity", { name: "Pan", stock: "" }],
    ["no quantity field", { name: "Pan" }],
  ])("creates a product without a quantity from %s", async (_label, fields) => {
    const res = await request(ctx.app).post("/api/shops/1/products").set("Cookie", owner).field(fields).expect(201);
    expect(ctx.repo.createProduct).toHaveBeenCalledWith(1, { name: "Pan", description: "", stock: null }, null);
    expect(res.body.stock).toBeNull();
  });

  it("stores the image when sent", async () => {
    await request(ctx.app)
      .post("/api/shops/1/products")
      .set("Cookie", owner)
      .field({ name: "Croissant", stock: "3" })
      .attach("image", PNG, { filename: "c.webp", contentType: "image/webp" })
      .expect(201);
    expect(ctx.repo.createProduct.mock.calls[0]![2]).toMatch(/^\/uploads\/.+\.webp$/);
  });

  it.each([
    [{ name: "", stock: "1" }, "El nombre es obligatorio"],
    [{ name: "Pan", stock: "-1" }, "La cantidad no puede ser negativa"],
    [{ name: "Pan", stock: "1.5" }, "La cantidad debe ser un número entero"],
  ])("validates %o", async (fields, message) => {
    const res = await request(ctx.app).post("/api/shops/1/products").set("Cookie", owner).field(fields).expect(400);
    expect(res.body.error).toBe(message);
  });

  it("returns 403 on another empresario's shop", async () => {
    ctx.repo.getShopOwner.mockResolvedValue({ ownerId: 999, imageUrl: "/uploads/s.png" });
    await request(ctx.app).post("/api/shops/1/products").set("Cookie", owner).field({ name: "Pan" }).expect(403);
    expect(ctx.repo.createProduct).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/products/:id/stock", () => {
  const patch = (body: object, cookie = owner) =>
    request(ctx.app).patch("/api/products/5/stock").set("Cookie", cookie).send(body);

  it("sets the stock of an own product", async () => {
    ctx.repo.getProductWithOwner.mockResolvedValue(ownProduct);
    const res = await patch({ stock: 20 }).expect(200);
    expect(ctx.repo.setStock).toHaveBeenCalledWith(5, 20);
    expect(res.body.stock).toBe(20);
  });

  it("accepts zero (sold out)", async () => {
    ctx.repo.getProductWithOwner.mockResolvedValue(ownProduct);
    await patch({ stock: 0 }).expect(200);
    expect(ctx.repo.setStock).toHaveBeenCalledWith(5, 0);
  });

  it("removes the quantity with null", async () => {
    ctx.repo.getProductWithOwner.mockResolvedValue(ownProduct);
    const res = await patch({ stock: null }).expect(200);
    expect(ctx.repo.setStock).toHaveBeenCalledWith(5, null);
    expect(res.body.stock).toBeNull();
  });

  it.each([{ stock: -1 }, { stock: 2.5 }, { stock: "muchos" }, {}])(
    "rejects %o before touching the DB",
    async (body) => {
      await patch(body).expect(400);
      expect(ctx.repo.getProductWithOwner).not.toHaveBeenCalled();
      expect(ctx.repo.setStock).not.toHaveBeenCalled();
    },
  );

  it("returns 403 for another empresario's product", async () => {
    ctx.repo.getProductWithOwner.mockResolvedValue(othersProduct);
    const res = await patch({ stock: 1 }).expect(403);
    expect(res.body.error).toBe("Este producto no es tuyo");
    expect(ctx.repo.setStock).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing product", async () => {
    await patch({ stock: 1 }).expect(404, { error: "Producto no encontrado" });
  });

  it("requires a session", async () => {
    await request(ctx.app).patch("/api/products/5/stock").send({ stock: 1 }).expect(401);
  });
});

describe("PUT /api/products/:id", () => {
  it("replaces the image and removes the old one", async () => {
    await writeFile(path.join(UPLOAD_DIR, "old-product.png"), PNG);
    ctx.repo.getProductWithOwner.mockResolvedValue({ ...ownProduct, imageUrl: "/uploads/old-product.png" });

    await request(ctx.app)
      .put("/api/products/5")
      .set("Cookie", owner)
      .field({ name: "Pan integral", description: "Con semillas", stock: "4" })
      .attach("image", PNG, { filename: "n.png", contentType: "image/png" })
      .expect(200);

    const [id, input, imageUrl] = ctx.repo.updateProduct.mock.calls[0]!;
    expect(id).toBe(5);
    expect(input).toEqual({ name: "Pan integral", description: "Con semillas", stock: 4 });
    expect(imageUrl).toMatch(/^\/uploads\//);
    expect(await readdir(UPLOAD_DIR)).not.toContain("old-product.png");
  });
});

describe("DELETE /api/products/:id", () => {
  it("deletes the product and its image", async () => {
    await writeFile(path.join(UPLOAD_DIR, "gone.png"), PNG);
    ctx.repo.getProductWithOwner.mockResolvedValue({ ...ownProduct, imageUrl: "/uploads/gone.png" });

    await request(ctx.app).delete("/api/products/5").set("Cookie", owner).expect(204);

    expect(ctx.repo.deleteProduct).toHaveBeenCalledWith(5);
    expect(await readdir(UPLOAD_DIR)).not.toContain("gone.png");
  });

  it("returns 403 for another empresario's product", async () => {
    ctx.repo.getProductWithOwner.mockResolvedValue(othersProduct);
    await request(ctx.app).delete("/api/products/5").set("Cookie", owner).expect(403);
    expect(ctx.repo.deleteProduct).not.toHaveBeenCalled();
  });
});
