import { z } from 'zod';
import type { GalleryPhoto } from './access';

/** Photos shown in each friend's slider on the Friends tab. */
export const FRIEND_PREVIEW_COUNT = 10;

export const FriendsQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});
export type FriendsQuery = z.infer<typeof FriendsQuerySchema>;

export const FriendParamsSchema = z.object({ guestId: z.string().min(1).max(64) });

export interface Friend {
  guestId: string;
  guestName: string;
  /** The signed-in guest */
  isMe: boolean;
  photoCount: number;
}

/** A guest who has shared photos, with their newest few for the slider. */
export interface FriendWithPreview extends Friend {
  preview: GalleryPhoto[];
}
