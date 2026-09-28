import type PgBoss from 'pg-boss';
import { prisma } from '@wm/db';
import { TRANSFORMS, parseEventSettings, type PhotoProcessJob } from '@wm/shared';
import { deliveryUrl } from '../lib/cloudinary';
import { blurhashFromImage, parseRenditionInfo } from '../lib/image';
import { logger } from '../lib/logger';

class MissingAssetError extends Error {}

async function fetchOk(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (res.status === 404) throw new MissingAssetError(`Asset not found: ${url.split('?')[0]}`);
  if (!res.ok) throw new Error(`Cloudinary responded ${res.status} for ${url.split('?')[0]}`);
  return res;
}

/**
 * Cloudinary already stores the original and renders every size on demand (converting HEIC,
 * applying EXIF rotation, stripping metadata). All that's left is to record the display size
 * for the gallery layout and a blurhash placeholder, then publish.
 */
export async function processPhoto({ photoId }: PhotoProcessJob) {
  const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { event: true } });
  if (!photo || photo.status !== 'PROCESSING') {
    logger.info({ photoId, status: photo?.status }, 'skipping photo, not awaiting processing');
    return;
  }

  const [info, tiny] = await Promise.all([
    fetchOk(deliveryUrl(photo.publicId, TRANSFORMS.displayInfo)).then((r) => r.json()),
    fetchOk(deliveryUrl(photo.publicId, TRANSFORMS.tiny)).then(async (r) => Buffer.from(await r.arrayBuffer())),
  ]);

  const size = parseRenditionInfo(info);
  const blurhash = await blurhashFromImage(tiny);
  const settings = parseEventSettings(photo.event.settings);

  await prisma.photo.update({
    where: { id: photo.id },
    data: {
      width: size?.width ?? null,
      height: size?.height ?? null,
      blurhash,
      status: settings.moderateBeforePublish ? 'HIDDEN' : 'READY',
    },
  });

  logger.info({ photoId, ...size }, 'photo processed');
}

/** pg-boss handler: retries on error, then marks the photo FAILED after the last attempt. */
export async function handleProcessPhoto(jobs: PgBoss.JobWithMetadata<PhotoProcessJob>[]) {
  for (const job of jobs) {
    try {
      await processPhoto(job.data);
    } catch (err) {
      // A missing asset won't appear on retry; anything else (network, 5xx) might.
      const finalAttempt = err instanceof MissingAssetError || job.retryCount >= job.retryLimit;
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
