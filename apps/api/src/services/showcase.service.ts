import { randomUUID } from 'node:crypto';
import {
  MAX_SHOWCASE_PHOTOS,
  TRANSFORMS,
  publicIds,
  type ShowcaseAdd,
  type ShowcaseItem,
} from '@wm/shared';
import { prisma } from '../lib/prisma';
import { AppError, notFound } from '../lib/errors';
import { deliveryUrl, destroyAsset, signUpload, verifyUploadResponse } from '../lib/cloudinary';
import { audit } from '../lib/audit';
import { logger } from '../lib/logger';
import { env } from '../env';
import type { AdminCtx } from '../middleware/requireAdmin';

type ShowcaseRow = {
  id: string;
  publicId: string;
  width: number | null;
  height: number | null;
  caption: string | null;
};

export function toShowcaseItem(row: ShowcaseRow): ShowcaseItem {
  return {
    id: row.id,
    url: deliveryUrl(row.publicId, TRANSFORMS.showcase),
    thumbUrl: deliveryUrl(row.publicId, TRANSFORMS.showcaseThumb),
    placeholderUrl: deliveryUrl(row.publicId, TRANSFORMS.placeholder),
    width: row.width,
    height: row.height,
    caption: row.caption,
  };
}

export async function listShowcase(eventId: string): Promise<ShowcaseItem[]> {
  const rows = await prisma.showcasePhoto.findMany({
    where: { eventId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(toShowcaseItem);
}

/** Signed upload for a welcome-page photo. */
export async function createShowcaseUpload(eventId: string) {
  const count = await prisma.showcasePhoto.count({ where: { eventId } });
  if (count >= MAX_SHOWCASE_PHOTOS) {
    throw new AppError(400, 'BAD_REQUEST', `The welcome page can show up to ${MAX_SHOWCASE_PHOTOS} photos.`);
  }
  const publicId = publicIds.showcase(env.CLOUDINARY_FOLDER, eventId, randomUUID());
  return { publicId, ...signUpload(publicId) };
}

/** Rotated display size, so the page can reserve space before the image loads. */
async function renditionSize(publicId: string) {
  try {
    const res = await fetch(deliveryUrl(publicId, 'c_limit,w_2000/fl_getinfo'), {
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { output?: { width?: number; height?: number } };
    const { width, height } = json.output ?? {};
    return width && height ? { width: Math.round(width), height: Math.round(height) } : null;
  } catch (err) {
    logger.warn({ err, publicId }, 'could not read showcase photo size');
    return null;
  }
}

/** Registers an uploaded photo after checking Cloudinary's signed response. */
export async function addShowcasePhoto(admin: AdminCtx, eventId: string, input: ShowcaseAdd) {
  const prefix = publicIds.showcase(env.CLOUDINARY_FOLDER, eventId, '');
  if (!input.public_id.startsWith(prefix) || !verifyUploadResponse(input.public_id, input.version, input.signature)) {
    throw new AppError(400, 'BAD_REQUEST', 'Upload could not be verified. Please try again.');
  }

  const last = await prisma.showcasePhoto.findFirst({
    where: { eventId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const size = await renditionSize(input.public_id);
  const row = await prisma.showcasePhoto.create({
    data: {
      eventId,
      publicId: input.public_id,
      width: size?.width ?? null,
      height: size?.height ?? null,
      position: (last?.position ?? -1) + 1,
    },
  });
  await audit({ adminId: admin.id, eventId, action: 'showcase.add', targetId: row.id });
  return toShowcaseItem(row);
}

export async function updateShowcaseCaption(admin: AdminCtx, eventId: string, photoId: string, caption: string | null) {
  const row = await prisma.showcasePhoto.findFirst({ where: { id: photoId, eventId } });
  if (!row) throw notFound('Photo');
  const updated = await prisma.showcasePhoto.update({
    where: { id: row.id },
    data: { caption: caption || null },
  });
  await audit({ adminId: admin.id, eventId, action: 'showcase.caption', targetId: row.id });
  return toShowcaseItem(updated);
}

/** Saves a new order; `ids` lists the event's welcome photos first to last. */
export async function reorderShowcase(admin: AdminCtx, eventId: string, ids: string[]) {
  const rows = await prisma.showcasePhoto.findMany({ where: { eventId }, select: { id: true } });
  const known = new Set(rows.map((r) => r.id));
  if (ids.length !== known.size || !ids.every((id) => known.has(id))) {
    throw new AppError(400, 'BAD_REQUEST', 'The photo list changed. Please reload and try again.');
  }
  await prisma.$transaction(
    ids.map((id, position) => prisma.showcasePhoto.update({ where: { id }, data: { position } })),
  );
  await audit({ adminId: admin.id, eventId, action: 'showcase.reorder' });
  return listShowcase(eventId);
}

export async function deleteShowcasePhoto(admin: AdminCtx, eventId: string, photoId: string) {
  const row = await prisma.showcasePhoto.findFirst({ where: { id: photoId, eventId } });
  if (!row) throw notFound('Photo');
  await prisma.showcasePhoto.delete({ where: { id: row.id } });
  await destroyAsset(row.publicId).catch((err) => logger.warn({ err, photoId }, 'cloudinary destroy failed'));
  await audit({ adminId: admin.id, eventId, action: 'showcase.delete', targetId: row.id });
}
