import { z } from 'zod';
import { AccessStatusSchema } from './guest';

export const FamilyCodeSchema = z.object({
  code: z.string().trim().min(4, 'Enter the family code').max(64),
});

export type FamilyCode = z.infer<typeof FamilyCodeSchema>;

export const AccessStateSchema = z.object({ status: AccessStatusSchema });
export type AccessState = z.infer<typeof AccessStateSchema>;

export const GalleryQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(30),
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export type GalleryQuery = z.infer<typeof GalleryQuerySchema>;

export interface GalleryPhoto {
  id: string;
  width: number;
  height: number;
  blurhash: string | null;
  thumbUrl: string;
  displayUrl: string;
  guestName: string;
  featured: boolean;
  likeCount: number;
  commentCount: number;
  /** The signed-in guest has liked this photo */
  likedByMe: boolean;
  takenAt: string | null;
  createdAt: string;
}
