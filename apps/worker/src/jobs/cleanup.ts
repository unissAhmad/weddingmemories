import type PgBoss from 'pg-boss';
import { prisma } from '@wm/db';
import { DELETED_PHOTO_RETENTION_DAYS, QUEUES } from '@wm/shared';
import { abortMultipartUpload, deleteObject } from '../lib/r2';
import { logger } from '../lib/logger';

const BATCH = 200;
const HOUR = 3_600_000;

const ignoreMissing = (p: Promise<unknown>) => p.catch(() => {});

/** Soft-deleted photos are purged from R2 (and the database) after the retention window. */
async function purgeDeletedPhotos() {
  const photos = await prisma.photo.findMany({
    where: {
      status: 'DELETED',
      deletedAt: { lt: new Date(Date.now() - DELETED_PHOTO_RETENTION_DAYS * 24 * HOUR) },
    },
    take: BATCH,
  });
  for (const p of photos) {
    const keys = [p.originalKey, p.displayKey, p.thumbKey].filter((k): k is string => Boolean(k));
    await Promise.all(keys.map((k) => ignoreMissing(deleteObject(k))));
    await prisma.photo.delete({ where: { id: p.id } });
  }
  return photos.length;
}

/** Uploads a guest started but never finished. */
async function abortStaleUploads() {
  const photos = await prisma.photo.findMany({
    where: { status: 'UPLOADING', createdAt: { lt: new Date(Date.now() - 24 * HOUR) } },
    take: BATCH,
  });
  for (const p of photos) {
    if (p.uploadId) await ignoreMissing(abortMultipartUpload(p.originalKey, p.uploadId));
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

async function expireZips() {
  const jobs = await prisma.downloadJob.findMany({
    where: { status: 'DONE', expiresAt: { lt: new Date() }, NOT: { zipKeys: { isEmpty: true } } },
    take: BATCH,
  });
  for (const j of jobs) {
    await Promise.all(j.zipKeys.map((k) => ignoreMissing(deleteObject(k))));
    await prisma.downloadJob.update({ where: { id: j.id }, data: { zipKeys: [] } });
  }
  return jobs.length;
}

async function pruneTables() {
  const [otps, limits] = await Promise.all([
    prisma.otpCode.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * HOUR) } } }),
    prisma.rateLimitHit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - HOUR) } } }),
  ]);
  return otps.count + limits.count;
}

export async function runCleanup(boss: PgBoss) {
  const result = {
    purgedPhotos: await purgeDeletedPhotos(),
    abortedUploads: await abortStaleUploads(),
    requeuedPhotos: await requeueStuckPhotos(boss),
    expiredZips: await expireZips(),
    prunedRows: await pruneTables(),
  };
  if (Object.values(result).some((n) => n > 0)) logger.info(result, 'cleanup finished');
  return result;
}
