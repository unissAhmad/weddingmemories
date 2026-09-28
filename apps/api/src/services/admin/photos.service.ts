import type { AdminPhoto, AdminPhotoQuery, Page, PhotoAction } from '@wm/shared';
import type { Prisma } from '@wm/db';
import { prisma } from '../../lib/prisma';
import { afterCursor, newestFirst, toPage } from '../../lib/cursor';
import { signedGetUrl } from '../../lib/r2';
import { audit } from '../../lib/audit';
import type { AdminCtx } from '../../middleware/requireAdmin';

export async function listPhotos(eventId: string, query: AdminPhotoQuery): Promise<Page<AdminPhoto>> {
  const createdAt: Prisma.DateTimeFilter = {};
  if (query.from) createdAt.gte = new Date(`${query.from}T00:00:00Z`);
  if (query.to) createdAt.lt = new Date(new Date(`${query.to}T00:00:00Z`).getTime() + 86_400_000);

  const rows = await prisma.photo.findMany({
    where: {
      AND: [
        {
          eventId,
          status: query.status ?? { notIn: ['UPLOADING', 'DELETED'] },
          ...(query.guestId && { guestId: query.guestId }),
          ...(query.featured !== undefined && { featured: query.featured }),
          ...((query.from || query.to) && { createdAt }),
        },
        afterCursor(query.cursor),
      ],
    },
    orderBy: newestFirst,
    take: query.limit + 1,
    include: { guest: { select: { name: true } } },
  });

  const { page, nextCursor } = toPage(rows, query.limit);
  const items = await Promise.all(
    page.map(async (p) => ({
      id: p.id,
      status: p.status,
      featured: p.featured,
      width: p.width,
      height: p.height,
      blurhash: p.blurhash,
      thumbUrl: p.thumbKey ? await signedGetUrl(p.thumbKey) : null,
      displayUrl: p.displayKey ? await signedGetUrl(p.displayKey) : null,
      guestId: p.guestId,
      guestName: p.guest.name,
      originalName: p.originalName,
      sizeBytes: p.sizeBytes,
      takenAt: p.takenAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
  );
  return { items, nextCursor };
}

const ACTIONS: Record<
  PhotoAction['action'],
  { where: Prisma.PhotoWhereInput; data: Prisma.PhotoUpdateManyMutationInput }
> = {
  hide: { where: { status: 'READY' }, data: { status: 'HIDDEN' } },
  // Only photos that finished processing can be published.
  unhide: { where: { status: 'HIDDEN', displayKey: { not: null } }, data: { status: 'READY' } },
  feature: { where: { status: { in: ['READY', 'HIDDEN'] } }, data: { featured: true } },
  unfeature: { where: {}, data: { featured: false } },
  // Soft delete; the cleanup job purges R2 after the retention window.
  delete: {
    where: { status: { notIn: ['DELETED', 'UPLOADING'] } },
    data: { status: 'DELETED', deletedAt: new Date(), sha256: null, featured: false },
  },
};

export async function applyPhotoAction(admin: AdminCtx, eventId: string, input: PhotoAction) {
  const { where, data } = ACTIONS[input.action];
  const stamped = input.action === 'delete' ? { ...data, deletedAt: new Date() } : data;

  const result = await prisma.$transaction(async (tx) => {
    const r = await tx.photo.updateMany({
      where: { ...where, id: { in: input.ids }, eventId },
      data: stamped,
    });
    await audit(
      { adminId: admin.id, eventId, action: `photo.${input.action}`, meta: { ids: input.ids, updated: r.count } },
      tx,
    );
    return r;
  });
  return { updated: result.count };
}
