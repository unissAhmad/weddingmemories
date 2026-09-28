import { z } from 'zod';
import { ALLOWED_MIME_TYPES } from './constants';

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/, 'Invalid sha256');

export const UploadInitSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  size: z.number().int().positive(),
  sha256: Sha256Schema,
});

export type UploadInit = z.infer<typeof UploadInitSchema>;

/** Everything the browser needs to upload straight to Cloudinary with a signed request. */
export interface SignedUpload {
  /** https://api.cloudinary.com/v1_1/<cloud>/image/upload */
  uploadUrl: string;
  /** Form fields to send with the file (includes api_key, timestamp and signature). */
  params: Record<string, string>;
}

export interface UploadInitResponse extends SignedUpload {
  photoId: string;
}

export const PhotoIdParamsSchema = z.object({ id: z.string().min(1).max(64) });

/**
 * The fields of Cloudinary's upload response that the API needs. `signature` covers
 * public_id + version, which proves the upload really happened; the rest is informational.
 */
export const UploadCompleteSchema = z.object({
  public_id: z.string().min(1).max(300),
  version: z.union([z.number(), z.string()]).transform(String),
  signature: z.string().min(10).max(128),
  format: z.string().max(20).optional(),
  bytes: z.number().int().nonnegative().optional(),
  image_metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UploadComplete = z.infer<typeof UploadCompleteSchema>;

export const PhotoStatusSchema = z.enum([
  'UPLOADING',
  'PROCESSING',
  'READY',
  'HIDDEN',
  'DELETED',
  'FAILED',
]);

export type PhotoStatus = z.infer<typeof PhotoStatusSchema>;

export const MyPhotoSchema = z.object({
  id: z.string(),
  status: PhotoStatusSchema,
  width: z.number().nullable(),
  height: z.number().nullable(),
  blurhash: z.string().nullable(),
  thumbUrl: z.string().nullable(),
  displayUrl: z.string().nullable(),
  createdAt: z.string(),
});

export type MyPhoto = z.infer<typeof MyPhotoSchema>;

export interface PhotoProcessJob {
  photoId: string;
}

/** Cloudinary public_ids. `folder` separates environments (e.g. wm-dev vs wedding-memories). */
export const publicIds = {
  original: (folder: string, eventId: string, photoId: string) =>
    `${folder}/events/${eventId}/originals/${photoId}`,
  cover: (folder: string, eventId: string, id: string) => `${folder}/events/${eventId}/cover/${id}`,
};

/**
 * Derived images are Cloudinary on-the-fly transformations of the original. Transformed images
 * are delivered without EXIF/GPS metadata and auto-rotated using the EXIF orientation.
 * f_auto serves WebP/AVIF to browsers that support them (and converts HEIC).
 */
export const TRANSFORMS = {
  thumb: 'c_limit,w_400/f_auto,q_auto',
  display: 'c_limit,w_1600/f_auto,q_auto',
  cover: 'c_limit,w_2000/f_auto,q_auto',
  /** Tiny JPEG used by the worker to compute the blurhash. */
  tiny: 'c_limit,w_32,h_32/f_jpg,q_70',
  /** JSON describing the display rendition (its final, rotated dimensions). */
  displayInfo: 'c_limit,w_1600/fl_getinfo',
} as const;
