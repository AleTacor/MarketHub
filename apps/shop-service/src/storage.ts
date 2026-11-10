import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@markethub/shared";
import { config } from "./config";
import { HttpError } from "./errors";

/**
 * Local-disk image storage. Files go to UPLOAD_DIR and are served by nginx
 * under PUBLIC_UPLOAD_PATH. Swap this module for S3/R2 in production.
 */

const EXTENSIONS: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, "La imagen debe ser JPG, PNG o WEBP"));
  },
}).single("image");

export async function saveImage(file: Express.Multer.File): Promise<string> {
  await mkdir(config.UPLOAD_DIR, { recursive: true });
  const name = `${randomUUID()}${EXTENSIONS[file.mimetype] ?? ""}`;
  await writeFile(path.join(config.UPLOAD_DIR, name), file.buffer);
  return `${config.PUBLIC_UPLOAD_PATH}/${name}`;
}

export async function deleteImage(url: string | null | undefined) {
  if (!url?.startsWith(`${config.PUBLIC_UPLOAD_PATH}/`)) return;
  const name = path.basename(url);
  await unlink(path.join(config.UPLOAD_DIR, name)).catch(() => undefined);
}
