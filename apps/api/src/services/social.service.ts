import type { LikeState, PhotoCommentItem, PhotoLiker } from '@wm/shared';
import { prisma } from '../lib/prisma';
import { forbidden, notFound } from '../lib/errors';
import { assertGalleryAccess } from './access.service';

type GuestCtx = { id: string; eventId: string };

/** Likes and comments by guests who have since been blocked are hidden everywhere. */
export const visibleGuest = { guest: { blocked: false } } as const;

// A wedding has at most a few hundred guests, so lists are returned whole.
const LIST_LIMIT = 500;

/** Only guests who can see the gallery can react, and only to published photos of their event. */
async function viewablePhoto(guest: GuestCtx, photoId: string) {
  await assertGalleryAccess(guest);
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, eventId: guest.eventId, status: 'READY' },
    select: { id: true },
  });
  if (!photo) throw notFound('Photo');
  return photo;
}

const countLikes = (photoId: string) => prisma.photoLike.count({ where: { photoId, ...visibleGuest } });

export async function likePhoto(guest: GuestCtx, photoId: string): Promise<LikeState> {
  await viewablePhoto(guest, photoId);
  // Idempotent: liking twice (double tap, retry on bad Wi-Fi) keeps a single like.
  await prisma.photoLike.upsert({
    where: { photoId_guestId: { photoId, guestId: guest.id } },
    create: { photoId, guestId: guest.id },
    update: {},
  });
  return { liked: true, likeCount: await countLikes(photoId) };
}

export async function unlikePhoto(guest: GuestCtx, photoId: string): Promise<LikeState> {
  await viewablePhoto(guest, photoId);
  await prisma.photoLike.deleteMany({ where: { photoId, guestId: guest.id } });
  return { liked: false, likeCount: await countLikes(photoId) };
}

export async function listLikes(guest: GuestCtx, photoId: string): Promise<PhotoLiker[]> {
  await viewablePhoto(guest, photoId);
  const likes = await prisma.photoLike.findMany({
    where: { photoId, ...visibleGuest },
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
    include: { guest: { select: { name: true } } },
  });
  return likes.map((l) => ({
    guestId: l.guestId,
    guestName: l.guest.name,
    isMe: l.guestId === guest.id,
    createdAt: l.createdAt.toISOString(),
  }));
}

function toItem(
  c: { id: string; guestId: string; body: string; createdAt: Date; guest: { name: string } },
  viewerId: string,
): PhotoCommentItem {
  return {
    id: c.id,
    guestName: c.guest.name,
    body: c.body,
    mine: c.guestId === viewerId,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function listComments(guest: GuestCtx, photoId: string): Promise<PhotoCommentItem[]> {
  await viewablePhoto(guest, photoId);
  const comments = await prisma.photoComment.findMany({
    where: { photoId, ...visibleGuest },
    orderBy: { createdAt: 'asc' },
    take: LIST_LIMIT,
    include: { guest: { select: { name: true } } },
  });
  return comments.map((c) => toItem(c, guest.id));
}

export async function addComment(guest: GuestCtx, photoId: string, body: string): Promise<PhotoCommentItem> {
  await viewablePhoto(guest, photoId);
  const comment = await prisma.photoComment.create({
    data: { photoId, guestId: guest.id, body },
    include: { guest: { select: { name: true } } },
  });
  return toItem(comment, guest.id);
}

export async function deleteOwnComment(guest: GuestCtx, photoId: string, commentId: string) {
  await viewablePhoto(guest, photoId);
  const comment = await prisma.photoComment.findFirst({ where: { id: commentId, photoId } });
  if (!comment) throw notFound('Comment');
  if (comment.guestId !== guest.id) throw forbidden('You can only delete your own comments');
  await prisma.photoComment.delete({ where: { id: comment.id } });
}
