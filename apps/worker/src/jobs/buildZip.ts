import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import type PgBoss from 'pg-boss';
import { ZipArchive } from 'archiver';
import { prisma, type Prisma } from '@wm/db';
import {
  DownloadScopeSchema,
  ZIP_LINK_TTL_HOURS,
  ZIP_PART_BYTES,
  type DownloadScope,
  type ZipBuildJob,
} from '@wm/shared';
import { getObjectStream, signedDownloadUrl, streamUpload } from '../lib/r2';
import { logger } from '../lib/logger';
import { sendMail, zipReadyMail } from '../lib/mailer';
import { publicWebUrl } from '../env';
import { buildEntries, splitIntoParts, type ZipEntry } from './zipNames';

function scopeWhere(eventId: string, scope: DownloadScope): Prisma.PhotoWhereInput {
  const base: Prisma.PhotoWhereInput = {
    eventId,
    status: { in: ['READY', 'HIDDEN', 'PROCESSING', 'FAILED'] },
  };
  if (scope.type === 'guest') return { ...base, guestId: scope.guestId };
  if (scope.type === 'selection') return { ...base, id: { in: scope.photoIds } };
  return base;
}

const isMissing = (err: unknown) =>
  (err as { name?: string })?.name === 'NoSuchKey' ||
  (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404;

/**
 * Streams originals from R2 → archiver → multipart upload back to R2. Entries are appended one at
 * a time, so memory stays flat no matter how many photos there are.
 */
async function writePart(key: string, entries: ZipEntry[], onEntry: () => Promise<void>) {
  const archive = new ZipArchive({ store: true }); // photos are already compressed
  const body = new PassThrough();
  archive.on('warning', (err) => logger.warn({ err, key }, 'zip warning'));
  archive.on('error', (err) => body.destroy(err));
  archive.pipe(body);

  const upload = streamUpload(key, body, 'application/zip');
  const uploaded = upload.done();
  const missing: string[] = [];

  try {
    for (const entry of entries) {
      let source;
      try {
        source = await getObjectStream(entry.key);
      } catch (err) {
        if (!isMissing(err)) throw err;
        missing.push(entry.name);
        continue;
      }
      const added = once(archive, 'entry');
      archive.append(source, { name: entry.name, date: entry.date });
      await added;
      await onEntry();
    }
    if (missing.length) {
      archive.append(`These photos could not be found in storage:\n${missing.join('\n')}\n`, {
        name: '_missing.txt',
      });
    }
    await archive.finalize();
    await uploaded;
  } catch (err) {
    archive.abort();
    await upload.abort().catch(() => {});
    throw err;
  }
}

export async function buildZip({ jobId }: ZipBuildJob) {
  const job = await prisma.downloadJob.findUnique({
    where: { id: jobId },
    include: { event: { select: { id: true, name: true, slug: true } } },
  });
  if (!job || job.status === 'DONE') return;

  const scope = DownloadScopeSchema.parse(job.scope);
  const photos = await prisma.photo.findMany({
    where: scopeWhere(job.eventId, scope),
    select: {
      id: true,
      originalKey: true,
      sizeBytes: true,
      takenAt: true,
      createdAt: true,
      guest: { select: { id: true, name: true } },
    },
    orderBy: [{ guest: { name: 'asc' } }, { createdAt: 'asc' }],
  });

  const parts = splitIntoParts(buildEntries(photos), ZIP_PART_BYTES);
  const keys = parts.map((_, i) =>
    parts.length === 1
      ? `events/${job.eventId}/zips/${job.id}.zip`
      : `events/${job.eventId}/zips/${job.id}-part${i + 1}.zip`,
  );

  await prisma.downloadJob.update({
    where: { id: job.id },
    data: { status: 'RUNNING', doneCount: 0, photoCount: photos.length, error: null },
  });

  let done = 0;
  const onEntry = async () => {
    done += 1;
    if (done % 20 === 0) {
      await prisma.downloadJob.update({ where: { id: job.id }, data: { doneCount: done } });
    }
  };

  for (const [i, part] of parts.entries()) {
    await writePart(keys[i]!, part, onEntry);
    logger.info({ jobId, part: i + 1, of: parts.length, entries: part.length }, 'zip part uploaded');
  }

  const expiresAt = new Date(Date.now() + ZIP_LINK_TTL_HOURS * 3_600_000);
  await prisma.downloadJob.update({
    where: { id: job.id },
    data: { status: 'DONE', zipKeys: keys, doneCount: done, expiresAt, finishedAt: new Date() },
  });

  const admin = await prisma.admin.findUnique({ where: { id: job.requestedBy }, select: { email: true } });
  if (admin) {
    const links = await Promise.all(
      keys.map(async (key, i) => {
        const name =
          keys.length > 1
            ? `${job.event.slug}-photos-part${i + 1}-of-${keys.length}.zip`
            : `${job.event.slug}-photos.zip`;
        return { name, url: await signedDownloadUrl(key, name, ZIP_LINK_TTL_HOURS * 3600) };
      }),
    );
    const adminUrl = `${publicWebUrl}/admin/e/${job.eventId}/downloads`;
    await sendMail(zipReadyMail(admin.email, job.event.name, links, adminUrl, ZIP_LINK_TTL_HOURS)).catch(
      (err) => logger.error({ err, jobId }, 'zip ready email failed'),
    );
  }

  logger.info({ jobId, photos: done, parts: keys.length }, 'zip job done');
}

export async function handleBuildZip(jobs: PgBoss.JobWithMetadata<ZipBuildJob>[]) {
  for (const job of jobs) {
    try {
      await buildZip(job.data);
    } catch (err) {
      const finalAttempt = job.retryCount >= job.retryLimit;
      logger.error({ err, jobId: job.data.jobId, finalAttempt }, 'zip job failed');
      await prisma.downloadJob.update({
        where: { id: job.data.jobId },
        data: finalAttempt
          ? { status: 'FAILED', error: 'The download could not be created. Please try again.' }
          : { status: 'QUEUED' },
      });
      if (!finalAttempt) throw err;
    }
  }
}
