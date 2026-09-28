import type PgBoss from 'pg-boss';
import { prisma } from '@wm/db';
import { DELETED_PHOTO_RETENTION_DAYS, QUEUES } from '@wm/shared';
import { destroyAsset } from '../lib/cloudinary';
import { logger } from '../lib/logger';

const BATCH = 100;
const HOUR = 3_600_000;

/** Soft-deleted photos are removed from Cloudinary (and the database) after the retention window. */
async function purgeDeletedPhotos() {
  const photos = await prisma.photo.findMany({
    where: {
      status: 'DELETED',
      deletedAt: { lt: new Date(Date.now() - DELETED_PHOTO_RETENTION_DAYS * 24 * HOUR) },
    },
    select: { id: true, publicId: true },
    take: BATCH,
  });
  let purged = 0;
  for (const p of photos) {
    try {
      await destroyAsset(p.publicId);
      await prisma.photo.delete({ where: { id: p.id } });
      purged++;
    } catch (err) {
      logger.warn({ err, photoId: p.id }, 'purge failed; will retry next run');
    }
  }
  return purged;
}

/** Uploads a guest started but never completed (the file may or may not have reached Cloudinary). */
async function removeStaleUploads() {
  const photos = await prisma.photo.findMany({
    where: { status: 'UPLOADING', createdAt: { lt: new Date(Date.now() - 24 * HOUR) } },
    select: { id: true, publicId: true },
    take: BATCH,
  });
  for (const p of photos) {
    await destroyAsset(p.publicId).catch(() => {});
    await prisma.photo.delete({ where: { id: p.id } });
  }
  return photos.length;
}

/** Photos whose processing job was lost (e.g. a deploy mid-job) get queued again. */
async function requeueStuckPhotos(boss: PgBoss) {
  const photos = await prisma.photo.findMany({
    where: { status: 'PROCESSING', updatedAt: { lt: new Date(Date.now() - 0.5 * HOUR) } },
    select: { id: true },
    take: BATCH,
  });
  for (const p of photos) {
    await boss.send(QUEUES.photoProcess, { photoId: p.id }, { singletonKey: p.id });
    // Touch updatedAt so we don't requeue again on the next run.
    await prisma.photo.update({ where: { id: p.id }, data: { status: 'PROCESSING' } });
  }
  return photos.length;
}

async function pruneTables() {
  const [otps, limits, downloads] = await Promise.all([
    prisma.otpCode.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * HOUR) } } }),
    prisma.rateLimitHit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - HOUR) } } }),
    // Download links expire after a day; keep the records a month for the admin's history.
    prisma.downloadJob.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * HOUR) } } }),
  ]);
  return otps.count + limits.count + downloads.count;
}

export async function runCleanup(boss: PgBoss) {
  const result = {
    purgedPhotos: await purgeDeletedPhotos(),
    removedStaleUploads: await removeStaleUploads(),
    requeuedPhotos: await requeueStuckPhotos(boss),
    prunedRows: await pruneTables(),
  };
  if (Object.values(result).some((n) => n > 0)) logger.info(result, 'cleanup finished');
  return result;
}
