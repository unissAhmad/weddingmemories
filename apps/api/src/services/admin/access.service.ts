import type { AccessDecision, AccessListQuery, AdminAccessRequest, Page } from '@wm/shared';
import { prisma } from '../../lib/prisma';
import { afterCursor, newestFirst, toPage } from '../../lib/cursor';
import { audit } from '../../lib/audit';
import { accessApprovedMail, sendMail } from '../../lib/mailer';
import { logger } from '../../lib/logger';
import { guestEventUrl } from '../../env';
import type { AdminCtx } from '../../middleware/requireAdmin';

export async function listAccessRequests(
  eventId: string,
  query: AccessListQuery,
): Promise<Page<AdminAccessRequest>> {
  const rows = await prisma.accessRequest.findMany({
    where: { status: query.status, guest: { eventId }, ...afterCursor(query.cursor) },
    orderBy: newestFirst,
    take: query.limit + 1,
    include: { guest: { select: { name: true, contact: true } } },
  });
  const { page, nextCursor } = toPage(rows, query.limit);
  return {
    items: page.map((r) => ({
      id: r.id,
      guestId: r.guestId,
      guestName: r.guest.name,
      contact: r.guest.contact,
      status: r.status,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

/** Emails are best-effort: a failed email must not undo an approval. Code guests have no email. */
export async function notifyApproved(
  event: { slug: string; name: string },
  guests: { name: string; contact: string | null }[],
) {
  const url = `${guestEventUrl(event.slug)}/gallery`;
  const results = await Promise.allSettled(
    guests
      .filter((g): g is { name: string; contact: string } => g.contact !== null)
      .map((g) => sendMail(accessApprovedMail(g.contact, g.name, event.name, url))),
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed) logger.warn({ failed }, 'some access-approved emails failed');
}

export async function decideAccess(
  admin: AdminCtx,
  event: { id: string; slug: string; name: string },
  input: AccessDecision,
) {
  const targets = await prisma.accessRequest.findMany({
    where: { id: { in: input.ids }, guest: { eventId: event.id }, status: { not: input.status } },
    include: { guest: { select: { name: true, contact: true } } },
  });
  if (targets.length === 0) return { updated: 0 };

  await prisma.$transaction(async (tx) => {
    await tx.accessRequest.updateMany({
      where: { id: { in: targets.map((t) => t.id) } },
      data: { status: input.status, decidedBy: admin.id, decidedAt: new Date() },
    });
    await audit(
      {
        adminId: admin.id,
        eventId: event.id,
        action: input.status === 'APPROVED' ? 'access.approve' : 'access.reject',
        meta: { guestIds: targets.map((t) => t.guestId) },
      },
      tx,
    );
  });

  if (input.status === 'APPROVED') {
    void notifyApproved(event, targets.map((t) => t.guest));
  }
  return { updated: targets.length };
}
