import sharp from 'sharp';
import { encode as encodeBlurhash } from 'blurhash';

sharp.cache(false);

/** Blurhash placeholder from a small image (the worker fetches a 32px rendition). */
export async function blurhashFromImage(image: Buffer) {
  const { data, info } = await sharp(image)
    .resize(32, 32, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return encodeBlurhash(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}

/**
 * Cloudinary's fl_getinfo returns JSON describing a rendition. `output` has the final size
 * after resizing and EXIF auto-rotation, which is what the gallery lays out.
 */
export function parseRenditionInfo(json: unknown): { width: number; height: number } | null {
  const output = (json as { output?: { width?: unknown; height?: unknown } } | null)?.output;
  const width = Number(output?.width);
  const height = Number(output?.height);
  return width > 0 && height > 0 ? { width: Math.round(width), height: Math.round(height) } : null;
}
