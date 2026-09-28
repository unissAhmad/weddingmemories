import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import {
  parseEventSettings,
  type AdminEventDetail,
  type AdminEventSummary,
  type CoverUpload,
  type CreateEvent,
  type EventStats,
  type UpdateEvent,
} from '@wm/shared';
import { Prisma, prisma } from '../../lib/prisma';
import { AppError, notFound } from '../../lib/errors';
import { hashSecret } from '../../lib/secrets';
import { presignPut, signedGetUrl } from '../../lib/r2';
import { audit } from '../../lib/audit';
import { guestEventUrl } from '../../env';
import type { AdminCtx } from '../../middleware/requireAdmin';

const summary = (e: { id: string; slug: string; name: string; date: Date }): AdminEventSummary => ({
  id: e.id,
  slug: e.slug,
  name: e.name,
  date: e.date.toISOString(),
});

export async function listEvents(admin: AdminCtx) {
  const events = await prisma.event.findMany({
    where: admin.role === 'OWNER' ? {} : { admins: { some: { adminId: admin.id } } },
    orderBy: { date: 'desc' },
  });
  return events.map(summary);
}

export async function createEvent(admin: AdminCtx, input: CreateEvent) {
  try {
    const event = await prisma.event.create({
      data: {
        name: input.name,
        slug: input.slug,
        date: new Date(input.date),
        settings: parseEventSettings({}),
        admins: { create: { adminId: admin.id } },
      },
    });
    await audit({ adminId: admin.id, eventId: event.id, action: 'event.create', targetId: event.id });
    return summary(event);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'CONFLICT', 'That link is already used by another event.');
    }
    throw err;
  }
}

export async function getEventDetail(eventId: string): Promise<AdminEventDetail> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound('Event');
  const settings = parseEventSettings(event.settings);
  return {
    ...summary(event),
    coverUrl: event.coverKey ? await signedGetUrl(event.coverKey) : null,
    guestUrl: guestEventUrl(event.slug),
    settings: {
      uploadsOpen: settings.uploadsOpen,
      autoApprove: settings.autoApprove,
      moderateBeforePublish: settings.moderateBeforePublish,
      hasFamilyCode: settings.familyCodeHash !== null,
    },
  };
}

export async function updateEvent(admin: AdminCtx, eventId: string, input: UpdateEvent) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw notFound('Event');

  if (input.coverKey && !input.coverKey.startsWith(`events/${eventId}/cover/`)) {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid cover image');
  }

  const settings = parseEventSettings(event.settings);
  const next = {
    ...settings,
    ...(input.uploadsOpen !== undefined && { uploadsOpen: input.uploadsOpen }),
    ...(input.autoApprove !== undefined && { autoApprove: input.autoApprove }),
    ...(input.moderateBeforePublish !== undefined && {
      moderateBeforePublish: input.moderateBeforePublish,
    }),
    ...(input.familyCode !== undefined && {
      familyCodeHash: input.familyCode === null ? null : await hashSecret(input.familyCode),
    }),
  };

  await prisma.event.update({
    where: { id: eventId },
    data: {
      settings: next,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.date !== undefined && { date: new Date(input.date) }),
      ...(input.coverKey !== undefined && { coverKey: input.coverKey }),
    },
  });

  // Never log the family code itself, only that it changed.
  const changed = Object.keys(input).map((k) => (k === 'familyCode' ? 'familyCode(changed)' : k));
  await audit({ adminId: admin.id, eventId, action: 'event.update', targetId: eventId, meta: { changed } });

  return getEventDetail(eventId);
}

export async function createCoverUpload(eventId: string, input: CoverUpload) {
  const ext = input.mimeType.split('/')[1]!.replace('jpeg', 'jpg');
  const key = `events/${eventId}/cover/${randomUUID()}.${ext}`;
  return { key, url: await presignPut(key, input.mimeType) };
}

export async function getStats(eventId: string): Promise<EventStats> {
  const [guests, photoGroups, accessGroups, storage] = await Promise.all([
    prisma.guest.count({ where: { eventId } }),
    prisma.photo.groupBy({ by: ['status'], where: { eventId }, _count: true }),
    prisma.accessRequest.groupBy({ by: ['status'], where: { guest: { eventId } }, _count: true }),
    prisma.photo.aggregate({
      where: { eventId, status: { notIn: ['DELETED', 'UPLOADING'] } },
      _sum: { sizeBytes: true },
    }),
  ]);

  const photos = { UPLOADING: 0, PROCESSING: 0, READY: 0, HIDDEN: 0, DELETED: 0, FAILED: 0 };
  for (const g of photoGroups) photos[g.status] = g._count;
  const access = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const g of accessGroups) access[g.status] = g._count;

  return { guests, photos, access, storageBytes: storage._sum.sizeBytes ?? 0 };
}

export async function renderQr(slug: string, format: 'png' | 'svg') {
  const url = guestEventUrl(slug);
  // High error correction so the code still scans when printed small or partly covered.
  const opts = { errorCorrectionLevel: 'H' as const, margin: 2, color: { dark: '#2f2a26', light: '#ffffff' } };
  return format === 'svg'
    ? { body: await QRCode.toString(url, { ...opts, type: 'svg' }), contentType: 'image/svg+xml' }
    : { body: await QRCode.toBuffer(url, { ...opts, width: 1200 }), contentType: 'image/png' };
}
