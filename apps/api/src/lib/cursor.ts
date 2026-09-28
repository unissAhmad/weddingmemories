import { AppError } from './errors';

/** Opaque keyset cursor over (createdAt DESC, id DESC). */
export function encodeCursor(row: { createdAt: Date; id: string }) {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64url');
}

export function decodeCursor(cursor: string) {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || Number.isNaN(createdAt.getTime())) {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid cursor');
  }
  return { createdAt, id };
}

/** Prisma `where` fragment for rows strictly after the cursor. */
export function afterCursor(cursor?: string) {
  if (!cursor) return {};
  const c = decodeCursor(cursor);
  return {
    OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }],
  };
}

export const newestFirst = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

/** Fetch limit + 1 rows, then call this to split off the page and next cursor. */
export function toPage<T extends { createdAt: Date; id: string }>(rows: T[], limit: number) {
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return { page, nextCursor: rows.length > limit && last ? encodeCursor(last) : null };
}
