import type PgBoss from 'pg-boss';
import { Prisma, prisma } from '@wm/db';
import { parseEventSettings, r2Keys, type PhotoProcessJob } from '@wm/shared';
import { deleteObject, getObjectBuffer, putObject } from '../lib/r2';
import { processImage, sha256 } from '../lib/image';
import { logger } from '../lib/logger';

async function discardDuplicate(photo: { id: string; originalKey: string }, duplicateOf: string) {
  await prisma.photo.update({
    where: { id: photo.id },
    data: { status: 'DELETED', deletedAt: new Date(), sha256: null },
  });
  await deleteObject(photo.originalKey);
  logger.info({ photoId: photo.id, duplicateOf }, 'duplicate photo discarded');
}

export async function processPhoto({ photoId }: PhotoProcessJob) {
  const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { event: true } });
  if (!photo || photo.status !== 'PROCESSING') {
    logger.info({ photoId, status: photo?.status }, 'skipping photo, not awaiting processing');
    return;
  }

  const original = await getObjectBuffer(photo.originalKey);

  // The browser sends its own hash at upload time; trust only what we compute here.
  const hash = sha256(original);
  if (hash !== photo.sha256) {
    const dup = await prisma.photo.findFirst({
      where: { eventId: photo.eventId, sha256: hash, id: { not: photo.id } },
      select: { id: true },
    });
    if (dup) return discardDuplicate(photo, dup.id);
  }

  const image = await processImage(original);

  const displayKey = r2Keys.display(photo.eventId, photo.id);
  const thumbKey = r2Keys.thumb(photo.eventId, photo.id);
  await Promise.all([
    putObject(displayKey, image.display.data, 'image/webp'),
    putObject(thumbKey, image.thumb.data, 'image/webp'),
  ]);

  const settings = parseEventSettings(photo.event.settings);
  try {
    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        sha256: hash,
        displayKey,
        thumbKey,
        blurhash: image.blurhash,
        width: image.display.width,
        height: image.display.height,
        takenAt: image.takenAt,
        status: settings.moderateBeforePublish ? 'HIDDEN' : 'READY',
      },
    });
  } catch (err) {
    // Another photo claimed this hash between our check and the update.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      await Promise.all([deleteObject(displayKey), deleteObject(thumbKey)]);
      return discardDuplicate(photo, 'concurrent');
    }
    throw err;
  }

  logger.info(
    { photoId, width: image.display.width, height: image.display.height },
    'photo processed',
  );
}

/** pg-boss handler: retries on error, then marks the photo FAILED after the last attempt. */
export async function handleProcessPhoto(jobs: PgBoss.JobWithMetadata<PhotoProcessJob>[]) {
  for (const job of jobs) {
    try {
      await processPhoto(job.data);
    } catch (err) {
      const finalAttempt = job.retryCount >= job.retryLimit;
      logger.error(
        { err, photoId: job.data.photoId, attempt: job.retryCount + 1, finalAttempt },
        'photo processing failed',
      );
      if (!finalAttempt) throw err;
      await prisma.photo.updateMany({
        where: { id: job.data.photoId, status: 'PROCESSING' },
        data: { status: 'FAILED', sha256: null },
      });
    }
  }
}
