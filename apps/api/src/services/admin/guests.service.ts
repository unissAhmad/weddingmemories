import type { AdminGuest, GuestListQuery, GuestUpdate, Page } from '@wm/shared';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/errors';
import { afterCursor, newestFirst, toPage } from '../../lib/cursor';
import { audit } from '../../lib/audit';
import type { AdminCtx } from '../../middleware/requireAdmin';
import { notifyApproved } from './access.service';
import { revealAccessCode } from '../accessCode.service';

export async function listGuests(eventId: string, query: GuestListQuery): Promise<Page<AdminGuest>> {
  const search = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' as const } },
          { contact: { contains: query.q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const rows = await prisma.guest.findMany({
    where: { AND: [{ eventId }, search, afterCursor(query.cursor)] },
    orderBy: newestFirst,
    take: query.limit + 1,
    include: {
      access: { select: { status: true } },
      _count: { select: { photos: { where: { status: { notIn: ['DELETED', 'UPLOADING'] } } } } },
    },
  });

  const { page, nextCursor } = toPage(rows, query.limit);
  return {
    items: page.map((g) => ({
      id: g.id,
      name: g.name,
      contact: g.contact,
      accessCode: revealAccessCode(g.accessCodeEnc),
      blocked: g.blocked,
      access: g.access?.status ?? null,
      photoCount: g._count.photos,
      verifiedAt: g.verifiedAt?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

export async function updateGuest(
  admin: AdminCtx,
  event: { id: string; slug: string; name: string },
  guestId: string,
  input: GuestUpdate,
) {
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId: event.id },
    include: { access: true },
  });
  if (!guest) throw notFound('Guest');

  const newlyApproved = input.access === 'APPROVED' && guest.access?.status !== 'APPROVED';

  await prisma.$transaction(async (tx) => {
    if (input.blocked !== undefined) {
      await tx.guest.update({ where: { id: guest.id }, data: { blocked: input.blocked } });
    }
    if (input.access) {
      const decision = { status: input.access, decidedBy: admin.id, decidedAt: new Date() };
      await tx.accessRequest.upsert({
        where: { guestId: guest.id },
        update: decision,
        create: { guestId: guest.id, ...decision },
      });
    }
    await audit(
      {
        adminId: admin.id,
        eventId: event.id,
        action: 'guest.update',
        targetId: guest.id,
        meta: { ...input },
      },
      tx,
    );
  });

  if (newlyApproved && !guest.blocked && input.blocked !== true) {
    void notifyApproved(event, [guest]);
  }
  return { ok: true };
}
