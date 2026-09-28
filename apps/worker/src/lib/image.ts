import { createHash } from 'node:crypto';
import sharp from 'sharp';
import heicConvert from 'heic-convert';
import exifr from 'exifr';
import { encode as encodeBlurhash } from 'blurhash';

// Keep memory predictable in a long-running worker.
sharp.cache(false);

export const DISPLAY_WIDTH = 1600;
export const THUMB_WIDTH = 400;

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

export function sha256(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Detects HEIC/HEIF by its ISO-BMFF `ftyp` box rather than trusting the declared type. */
export function isHeif(buf: Buffer) {
  if (buf.length < 12 || buf.toString('ascii', 4, 8) !== 'ftyp') return false;
  return HEIF_BRANDS.has(buf.toString('ascii', 8, 12));
}

async function readTakenAt(buf: Buffer): Promise<Date | null> {
  try {
    const tags = await exifr.parse(buf, { pick: ['DateTimeOriginal', 'CreateDate'] });
    const value: unknown = tags?.DateTimeOriginal ?? tags?.CreateDate;
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
    const year = value.getUTCFullYear();
    return year >= 2000 && year <= 2100 ? value : null;
  } catch {
    return null;
  }
}

export interface ProcessedImage {
  display: { data: Buffer; width: number; height: number };
  thumb: { data: Buffer; width: number; height: number };
  blurhash: string;
  takenAt: Date | null;
}

/**
 * Builds the web derivatives from an original. The original is never modified.
 * sharp drops all metadata (EXIF, GPS, XMP) unless told to keep it, so derivatives are clean.
 */
export async function processImage(original: Buffer): Promise<ProcessedImage> {
  const takenAt = await readTakenAt(original);

  // sharp's prebuilt libvips can't decode HEVC-coded HEIC (patents), so convert first.
  // libheif applies the image's rotation during decode, so the JPEG comes out upright.
  const input = isHeif(original)
    ? Buffer.from(await heicConvert({ buffer: original, format: 'JPEG', quality: 0.92 }))
    : original;

  // rotate() with no args applies the EXIF orientation before resizing.
  const base = () => sharp(input, { failOn: 'truncated' }).rotate();

  const [display, thumb, tiny] = await Promise.all([
    base()
      .resize({ width: DISPLAY_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true }),
    base()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer({ resolveWithObject: true }),
    base()
      .resize(32, 32, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  const blurhash = encodeBlurhash(
    new Uint8ClampedArray(tiny.data),
    tiny.info.width,
    tiny.info.height,
    4,
    3,
  );

  return {
    display: { data: display.data, width: display.info.width, height: display.info.height },
    thumb: { data: thumb.data, width: thumb.info.width, height: thumb.info.height },
    blurhash,
    takenAt,
  };
}
