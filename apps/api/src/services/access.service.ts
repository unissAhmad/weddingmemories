import type { AccessState } from '@wm/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { verifySecret } from '../lib/secrets';
import { getEventById } from './events.service';

type GuestCtx = { id: string; eventId: string };

/** Decisions made by an admin can't be overridden by the family code. */
const ADMIN_DECIDED = (decidedBy: string | null) =>
  decidedBy !== null && decidedBy !== 'auto' && decidedBy !== 'family-code';

export async function requestAccess(guest: GuestCtx): Promise<AccessState> {
  const existing = await prisma.accessRequest.findUnique({ where: { guestId: guest.id } });
  if (existing) return { status: existing.status };

  const { settings } = await getEventById(guest.eventId);
  const created = await prisma.accessRequest.upsert({
    where: { guestId: guest.id },
    update: {},
    create: settings.autoApprove
      ? { guestId: guest.id, status: 'APPROVED', decidedBy: 'auto', decidedAt: new Date() }
      : { guestId: guest.id },
  });
  return { status: created.status };
}

export async function submitFamilyCode(guest: GuestCtx, code: string): Promise<AccessState> {
  const { settings } = await getEventById(guest.eventId);
  if (!settings.familyCodeHash) {
    throw new AppError(400, 'NO_FAMILY_CODE', 'This event does not use a family code.');
  }

  const existing = await prisma.accessRequest.findUnique({ where: { guestId: guest.id } });
  if (existing?.status === 'APPROVED') return { status: 'APPROVED' };
  if (existing?.status === 'REJECTED' && ADMIN_DECIDED(existing.decidedBy)) {
    throw new AppError(403, 'ACCESS_REJECTED', 'Please contact the couple for access to the gallery.');
  }

  if (!(await verifySecret(code, settings.familyCodeHash))) {
    throw new AppError(400, 'FAMILY_CODE_INVALID', "That code isn't right. Please check and try again.");
  }

  const approved = { status: 'APPROVED' as const, decidedBy: 'family-code', decidedAt: new Date() };
  await prisma.accessRequest.upsert({
    where: { guestId: guest.id },
    update: approved,
    create: { guestId: guest.id, ...approved },
  });
  return { status: 'APPROVED' };
}

export async function assertGalleryAccess(guest: GuestCtx) {
  const access = await prisma.accessRequest.findUnique({
    where: { guestId: guest.id },
    select: { status: true },
  });
  if (access?.status !== 'APPROVED') {
    throw new AppError(403, 'ACCESS_REQUIRED', 'The gallery is visible once your access is approved.');
  }
}
