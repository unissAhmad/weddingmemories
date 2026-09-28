import { z } from 'zod';
import { PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX } from './constants';

export const CursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_DEFAULT),
});

export type CursorQuery = z.infer<typeof CursorQuerySchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
