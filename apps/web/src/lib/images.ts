/**
 * Every place that shows an image uses its kind's fixed aspect ratio, and the upload
 * is cropped to that same ratio, so what the owner crops is exactly what is shown.
 * Keep `aspect` and `className` in sync.
 */
export interface ImageKind {
  aspect: number;
  /** Tailwind class with the same ratio, for <img> and placeholders. */
  className: string;
  /** Uploads are scaled down to at most this width. */
  maxWidth: number;
}

export const SHOP_IMAGE: ImageKind = { aspect: 16 / 9, className: "aspect-video", maxWidth: 1600 };
export const PRODUCT_IMAGE: ImageKind = { aspect: 4 / 3, className: "aspect-[4/3]", maxWidth: 1200 };
