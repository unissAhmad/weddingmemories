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

export const UploadInitResponseSchema = z.object({
  photoId: z.string(),
  uploadId: z.string(),
  key: z.string(),
});

export type UploadInitResponse = z.infer<typeof UploadInitResponseSchema>;

export const PhotoIdParamsSchema = z.object({ id: z.string().min(1).max(64) });

export const SignPartParamsSchema = PhotoIdParamsSchema.extend({
  partNumber: z.coerce.number().int().min(1).max(10_000),
});

export const UploadedPartSchema = z.object({
  PartNumber: z.number().int().min(1).max(10_000),
  ETag: z.string().min(1),
  Size: z.number().int().nonnegative().optional(),
});

export type UploadedPart = z.infer<typeof UploadedPartSchema>;

export const UploadCompleteSchema = z.object({
  parts: z.array(UploadedPartSchema).min(1).max(10_000),
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

/** Photo IDs are embedded in the object key: events/{eventId}/originals/{photoId}.{ext} */
export function photoIdFromKey(key: string): string | null {
  const match = /\/originals\/([^/.]+)\.[a-z0-9]+$/.exec(key);
  return match?.[1] ?? null;
}

export const r2Keys = {
  original: (eventId: string, photoId: string, ext: string) =>
    `events/${eventId}/originals/${photoId}.${ext}`,
  display: (eventId: string, photoId: string) => `events/${eventId}/display/${photoId}.webp`,
  thumb: (eventId: string, photoId: string) => `events/${eventId}/thumbs/${photoId}.webp`,
};
