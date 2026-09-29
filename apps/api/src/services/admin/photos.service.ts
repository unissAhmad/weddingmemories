import { TRANSFORMS, type AdminComment, type AdminPhoto, type AdminPhotoQuery, type Page, type PhotoAction } from '@wm/shared';
import type { Prisma } from '@wm/db';
import { prisma } from '../../lib/prisma';
import { afterCursor, newestFirst, toPage } from '../../lib/cursor';
import { deliveryUrl } from '../../lib/cloudinary';
import { audit } from '../../lib/audit';
import type { AdminCtx } from '../../middleware/requireAdmin';
import { notFound } from '../../lib/errors';
import { visibleGuest } from '../social.service';

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
    include: {
      guest: { select: { name: true } },
      _count: { select: { likes: { where: visibleGuest }, comments: { where: visibleGuest } } },
    },
  });

  const { page, nextCursor } = toPage(rows, query.limit);
  const items = page.map((p) => {
    const viewable = p.status !== 'FAILED';
    return {
      id: p.id,
      status: p.status,
      featured: p.featured,
      width: p.width,
      height: p.height,
      blurhash: p.blurhash,
      thumbUrl: viewable ? deliveryUrl(p.publicId, TRANSFORMS.thumb) : null,
      displayUrl: viewable ? deliveryUrl(p.publicId, TRANSFORMS.display) : null,
      guestId: p.guestId,
      guestName: p.guest.name,
      originalName: p.originalName,
      sizeBytes: p.sizeBytes,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      takenAt: p.takenAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    };
  });
  return { items, nextCursor };
}

const ACTIONS: Record<
  PhotoAction['action'],
  { where: Prisma.PhotoWhereInput; data: Prisma.PhotoUpdateManyMutationInput }
> = {
  hide: { where: { status: 'READY' }, data: { status: 'HIDDEN' } },
  // Only photos that finished processing can be published.
  unhide: { where: { status: 'HIDDEN', width: { not: null } }, data: { status: 'READY' } },
  feature: { where: { status: { in: ['READY', 'HIDDEN'] } }, data: { featured: true } },
  unfeature: { where: {}, data: { featured: false } },
  // Soft delete; the cleanup job removes it from Cloudinary after the retention window.
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

/* Comment moderation */

export async function listPhotoComments(eventId: string, photoId: string): Promise<AdminComment[]> {
  const photo = await prisma.photo.findFirst({ where: { id: photoId, eventId }, select: { id: true } });
  if (!photo) throw notFound('Photo');
  const comments = await prisma.photoComment.findMany({
    where: { photoId },
    orderBy: { createdAt: 'asc' },
    include: { guest: { select: { name: true } } },
  });
  return comments.map((c) => ({
    id: c.id,
    guestId: c.guestId,
    guestName: c.guest.name,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function deleteComment(admin: AdminCtx, eventId: string, commentId: string) {
  const comment = await prisma.photoComment.findFirst({
    where: { id: commentId, photo: { eventId } },
    include: { guest: { select: { name: true } } },
  });
  if (!comment) throw notFound('Comment');
  await prisma.photoComment.delete({ where: { id: comment.id } });
  // Keep what was removed, so the audit log shows why.
  await audit({
    adminId: admin.id,
    eventId,
    action: 'comment.delete',
    targetId: comment.photoId,
    meta: { guest: comment.guest.name, body: comment.body.slice(0, 200) },
  });
}
