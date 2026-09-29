import { FRIEND_PREVIEW_COUNT, type Friend, type FriendWithPreview, type FriendsQuery, type Page } from '@wm/shared';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { newestFirst } from '../lib/cursor';
import { assertGalleryAccess } from './access.service';
import { galleryInclude, parseOffset, toGalleryPhoto } from './photos.service';

type GuestCtx = { id: string; eventId: string };

/** Friends are the guests who have shared photos, blocked guests excepted. */
const sharedPhotos = (eventId: string) => ({ eventId, status: 'READY' as const, guest: { blocked: false } });

/** Guests who have shared, most recently active first, each with their newest photos. */
export async function listFriends(guest: GuestCtx, query: FriendsQuery): Promise<Page<FriendWithPreview>> {
  await assertGalleryAccess(guest);
  const offset = parseOffset(query.cursor);

  const groups = await prisma.photo.groupBy({
    by: ['guestId'],
    where: sharedPhotos(guest.eventId),
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: [{ _max: { createdAt: 'desc' } }, { guestId: 'asc' }],
    skip: offset,
    take: query.limit + 1,
  });
  const page = groups.slice(0, query.limit);

  const [guests, previews] = await Promise.all([
    prisma.guest.findMany({
      where: { id: { in: page.map((g) => g.guestId) } },
      select: { id: true, name: true },
    }),
    Promise.all(
      page.map((g) =>
        prisma.photo.findMany({
          where: { ...sharedPhotos(guest.eventId), guestId: g.guestId },
          orderBy: newestFirst,
          take: FRIEND_PREVIEW_COUNT,
          include: galleryInclude(guest.id),
        }),
      ),
    ),
  ]);
  const names = new Map(guests.map((g) => [g.id, g.name]));

  return {
    items: page.map((g, i) => ({
      guestId: g.guestId,
      guestName: names.get(g.guestId) ?? 'Guest',
      isMe: g.guestId === guest.id,
      photoCount: g._count._all,
      preview: previews[i]!.map(toGalleryPhoto),
    })),
    nextCursor: groups.length > query.limit ? `o:${offset + query.limit}` : null,
  };
}

/** Header for one friend's page. */
export async function getFriend(guest: GuestCtx, friendId: string): Promise<Friend> {
  await assertGalleryAccess(guest);
  const friend = await prisma.guest.findFirst({
    where: { id: friendId, eventId: guest.eventId, blocked: false },
    select: { id: true, name: true, _count: { select: { photos: { where: { status: 'READY' } } } } },
  });
  if (!friend) throw notFound('Guest');
  return {
    guestId: friend.id,
    guestName: friend.name,
    isMe: friend.id === guest.id,
    photoCount: friend._count.photos,
  };
}
