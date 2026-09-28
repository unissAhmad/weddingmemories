import type { AdminDownloadJob, DownloadScope } from '@wm/shared';
import { DownloadScopeSchema } from '@wm/shared';
import type { Prisma } from '@wm/db';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { signedDownloadUrl } from '../../lib/r2';
import { enqueueZipBuild } from '../../lib/queue';
import { audit } from '../../lib/audit';
import type { AdminCtx } from '../../middleware/requireAdmin';

/** Photos that belong in a download: everything except deleted or unfinished uploads. */
export function scopeWhere(eventId: string, scope: DownloadScope): Prisma.PhotoWhereInput {
  const base: Prisma.PhotoWhereInput = {
    eventId,
    status: { in: ['READY', 'HIDDEN', 'PROCESSING', 'FAILED'] },
  };
  if (scope.type === 'guest') return { ...base, guestId: scope.guestId };
  if (scope.type === 'selection') return { ...base, id: { in: scope.photoIds } };
  return base;
}

export async function createDownload(admin: AdminCtx, eventId: string, scope: DownloadScope) {
  const agg = await prisma.photo.aggregate({
    where: scopeWhere(eventId, scope),
    _count: true,
    _sum: { sizeBytes: true },
  });
  if (agg._count === 0) throw new AppError(400, 'BAD_REQUEST', 'There are no photos to download.');

  const job = await prisma.downloadJob.create({
    data: {
      eventId,
      requestedBy: admin.id,
      scope,
      photoCount: agg._count,
      totalBytes: BigInt(agg._sum.sizeBytes ?? 0),
    },
  });
  await audit({ adminId: admin.id, eventId, action: 'download.create', targetId: job.id, meta: { scope } });
  await enqueueZipBuild({ jobId: job.id });
  return { id: job.id };
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
      const expired = j.expiresAt !== null && j.expiresAt.getTime() <= now;
      const ttl = j.expiresAt ? (j.expiresAt.getTime() - now) / 1000 : 0;
      const parts =
        j.status === 'DONE' && !expired
          ? await Promise.all(
              j.zipKeys.map(async (key, i) => {
                const name =
                  j.zipKeys.length > 1
                    ? `${eventSlug}-photos-part${i + 1}-of-${j.zipKeys.length}.zip`
                    : `${eventSlug}-photos.zip`;
                return { name, url: await signedDownloadUrl(key, name, ttl) };
              }),
            )
          : [];
      return {
        id: j.id,
        status: j.status,
        scope: DownloadScopeSchema.parse(j.scope),
        photoCount: j.photoCount,
        doneCount: j.doneCount,
        totalBytes: Number(j.totalBytes),
        parts,
        expired,
        expiresAt: j.expiresAt?.toISOString() ?? null,
        error: j.error,
        createdAt: j.createdAt.toISOString(),
        finishedAt: j.finishedAt?.toISOString() ?? null,
      };
    }),
  );
}
