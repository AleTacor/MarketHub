/** Pixel area of the source image to keep (react-easy-crop's `croppedAreaPixels`). */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Cuts `area` out of `file` and returns it as a new file, scaled down to `maxWidth`.
 * PNGs stay PNG (they may have transparency); everything else becomes JPEG.
 */
export async function cropImage(file: File, area: CropArea, maxWidth: number): Promise<File> {
  // "from-image" applies EXIF rotation, matching the <img> the cropper showed.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxWidth / area.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no permite recortar imágenes");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) throw new Error("No se pudo recortar la imagen");
  const base = file.name.replace(/\.[^.]+$/, "") || "imagen";
  return new File([blob], `${base}.${type === "image/png" ? "png" : "jpg"}`, { type });
}
