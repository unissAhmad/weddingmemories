import { z } from 'zod';
import { PhotoIdParamsSchema } from './photos';

export const COMMENT_MAX_LENGTH = 500;

export const CommentCreateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something first')
    .max(COMMENT_MAX_LENGTH, `Keep it under ${COMMENT_MAX_LENGTH} characters`),
});
export type CommentCreate = z.infer<typeof CommentCreateSchema>;

export const CommentIdParamsSchema = PhotoIdParamsSchema.extend({ commentId: z.string().min(1).max(64) });

export interface LikeState {
  liked: boolean;
  likeCount: number;
}

export interface PhotoLiker {
  guestId: string;
  guestName: string;
  isMe: boolean;
  createdAt: string;
}

export interface PhotoCommentItem {
  id: string;
  guestName: string;
  body: string;
  /** The signed-in guest wrote it (and may delete it) */
  mine: boolean;
  createdAt: string;
}
