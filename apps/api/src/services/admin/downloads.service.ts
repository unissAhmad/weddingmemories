import { once } from 'node:events';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { Response } from 'express';
import { ZipArchive } from 'archiver';
import {
  DownloadScopeSchema,
  ZIP_LINK_TTL_HOURS,
  ZIP_PART_BYTES,
  type AdminDownloadJob,
  type DownloadScope,
} from '@wm/shared';
import type { Prisma } from '@wm/db';
import { prisma } from '../../lib/prisma';
import { AppError, notFound } from '../../lib/errors';
import { originalDownloadUrl } from '../../lib/cloudinary';
import { signZipToken, type ZipPartClaims } from '../../lib/jwt';
import { buildEntries, splitIntoParts } from '../../lib/zipNames';
import { audit } from '../../lib/audit';
import { logger } from '../../lib/logger';
import { publicApiUrl } from '../../env';
import type { AdminCtx } from '../../middleware/requireAdmin';

/** Photos that belong in a download: everything except deleted or unfinished uploads. */
function scopeWhere(eventId: string, scope: DownloadScope): Prisma.PhotoWhereInput {
  const base: Prisma.PhotoWhereInput = {
    eventId,
    status: { in: ['READY', 'HIDDEN', 'PROCESSING'] },
  };
  if (scope.type === 'guest') return { ...base, guestId: scope.guestId };
  if (scope.type === 'selection') return { ...base, id: { in: scope.photoIds } };
  return base;
}

/**
 * Snapshot the photos now (grouped by guest), so the part links stay stable even if more
 * photos arrive later. Nothing is built up front: each part is streamed when opened.
 */
export async function createDownload(admin: AdminCtx, eventId: string, scope: DownloadScope) {
  const photos = await prisma.photo.findMany({
    where: scopeWhere(eventId, scope),
    select: { id: true, sizeBytes: true },
    orderBy: [{ guest: { name: 'asc' } }, { guestId: 'asc' }, { createdAt: 'asc' }],
  });
  if (photos.length === 0) throw new AppError(400, 'BAD_REQUEST', 'There are no photos to download.');

  const job = await prisma.downloadJob.create({
    data: {
      eventId,
      requestedBy: admin.id,
      scope,
      photoIds: photos.map((p) => p.id),
      photoCount: photos.length,
      totalBytes: BigInt(photos.reduce((sum, p) => sum + p.sizeBytes, 0)),
      expiresAt: new Date(Date.now() + ZIP_LINK_TTL_HOURS * 3_600_000),
    },
  });
  await audit({ adminId: admin.id, eventId, action: 'download.create', targetId: job.id, meta: { scope } });
  return { id: job.id };
}

function partName(slug: string, index: number, total: number) {
  return total > 1 ? `${slug}-photos-part${index + 1}-of-${total}.zip` : `${slug}-photos.zip`;
}

export async function listDownloads(eventId: string, eventSlug: string): Promise<AdminDownloadJob[]> {
  const jobs = await prisma.downloadJob.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const now = Date.now();

  return Promise.all(
    jobs.map(async (j) => {
      const expired = !j.expiresAt || j.expiresAt.getTime() <= now;
      let parts: AdminDownloadJob['parts'] = [];
      if (!expired) {
        const sizes = await prisma.photo.findMany({
          where: { id: { in: j.photoIds } },
          select: { id: true, sizeBytes: true },
        });
        const sizeOf = new Map(sizes.map((s) => [s.id, s.sizeBytes]));
        // Index ranges into the snapshot, so a part's contents never shift.
        const indexed = j.photoIds.map((id, i) => ({ i, size: sizeOf.get(id) ?? 0 }));
        const split = splitIntoParts(indexed, ZIP_PART_BYTES);
        parts = await Promise.all(
          split.map(async (part, n) => {
            const token = await signZipToken(
              { jobId: j.id, from: part[0]!.i, to: part.at(-1)!.i + 1, part: n, parts: split.length },
              j.expiresAt!,
            );
            return {
              name: partName(eventSlug, n, split.length),
              url: `${publicApiUrl}/api/downloads/${token}`,
              photoCount: part.length,
            };
          }),
        );
      }
      return {
        id: j.id,
        scope: DownloadScopeSchema.parse(j.scope),
        photoCount: j.photoCount,
        totalBytes: Number(j.totalBytes),
        parts,
        expired,
        expiresAt: j.expiresAt?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
      };
    }),
  );
}

/**
 * Streams one ZIP part: originals are fetched from Cloudinary one at a time and piped through
 * archiver straight into the HTTP response, so memory stays flat regardless of size.
 */
export async function streamZipPart(claims: ZipPartClaims, res: Response) {
  const job = await prisma.downloadJob.findUnique({
    where: { id: claims.jobId },
    include: { event: { select: { slug: true } } },
  });
  if (!job) throw notFound('Download');
  if (!job.expiresAt || job.expiresAt.getTime() <= Date.now()) {
    throw new AppError(410, 'NOT_FOUND', 'This download link has expired. Create a new one in the admin panel.');
  }

  // Folder names are computed over the whole job so "Sara (2)" is consistent across parts.
  const rows = await prisma.photo.findMany({
    where: { id: { in: job.photoIds }, status: { notIn: ['DELETED', 'UPLOADING'] } },
    select: {
      id: true,
      publicId: true,
      format: true,
      sizeBytes: true,
      takenAt: true,
      createdAt: true,
      guest: { select: { id: true, name: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = job.photoIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
  const entryById = new Map(buildEntries(ordered).map((e, i) => [ordered[i]!.id, e]));
  const slice = job.photoIds.slice(claims.from, claims.to);

  const filename = partName(job.event.slug, claims.part, claims.parts);

  res.status(200);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');

  const archive = new ZipArchive({ store: true }); // photos are already compressed
  archive.on('warning', (err) => logger.warn({ err, jobId: job.id }, 'zip warning'));
  archive.pipe(res);

  let aborted = false;
  res.on('close', () => {
    if (!res.writableFinished) {
      aborted = true;
      archive.abort();
    }
  });

  const missing: string[] = [];
  for (const id of slice) {
    if (aborted) return;
    const entry = entryById.get(id);
    if (!entry) continue; // deleted since the download was created
    const file = await fetch(originalDownloadUrl(entry.publicId, entry.format)).catch(() => null);
    if (!file?.ok || !file.body) {
      missing.push(entry.name);
      continue;
    }
    const added = once(archive, 'entry');
    archive.append(Readable.fromWeb(file.body as WebReadableStream), {
      name: entry.name,
      date: entry.date,
    });
    await added;
  }

  if (missing.length) {
    archive.append(`These photos could not be downloaded from storage:\n${missing.join('\n')}\n`, {
      name: '_missing.txt',
    });
  }
  if (!aborted) await archive.finalize();
}
