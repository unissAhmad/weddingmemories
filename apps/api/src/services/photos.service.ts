import { randomUUID } from 'node:crypto';
import {
  MIME_EXTENSIONS,
  UPLOAD_PART_SIZE,
  type CursorQuery,
  type GalleryPhoto,
  type GalleryQuery,
  type MyPhoto,
  type Page,
  type UploadInit,
  type UploadInitResponse,
  type UploadedPart,
  r2Keys,
} from '@wm/shared';
import { Prisma, prisma } from '../lib/prisma';
import { AppError, notFound } from '../lib/errors';
import * as storage from '../lib/r2';
import { enqueuePhotoProcess } from '../lib/queue';
import { logger } from '../lib/logger';
import { maxUploadBytes } from '../env';
import { afterCursor, newestFirst, toPage } from '../lib/cursor';
import { getEventById } from './events.service';
import { assertGalleryAccess } from './access.service';

type GuestCtx = { id: string; eventId: string };

const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

const duplicate = () =>
  new AppError(409, 'DUPLICATE_PHOTO', 'This photo has already been shared.');

async function discardUpload(photo: { id: string; originalKey: string; uploadId: string | null }) {
  if (photo.uploadId) {
    await storage.abortMultipartUpload(photo.originalKey, photo.uploadId).catch((err) => {
      logger.warn({ err, photoId: photo.id }, 'abort multipart failed');
    });
  }
  await prisma.photo.delete({ where: { id: photo.id } });
}

export async function initUpload(guest: GuestCtx, input: UploadInit): Promise<UploadInitResponse> {
  const event = await getEventById(guest.eventId);
  if (!event.settings.uploadsOpen) {
    throw new AppError(403, 'UPLOADS_CLOSED', 'Uploads are closed for this event.');
  }
  if (input.size > maxUploadBytes) {
    throw new AppError(413, 'VALIDATION_ERROR', `Photos must be ${maxUploadBytes / 1024 / 1024} MB or smaller.`);
  }

  const existing = await prisma.photo.findUnique({
    where: { eventId_sha256: { eventId: guest.eventId, sha256: input.sha256 } },
  });
  if (existing) {
    // An unfinished upload of the same file (this guest retrying, or someone's abandoned
    // attempt) shouldn't block a fresh one.
    const abandoned =
      existing.status === 'UPLOADING' &&
      (existing.guestId === guest.id || Date.now() - existing.createdAt.getTime() > STALE_UPLOAD_MS);
    if (!abandoned) throw duplicate();
    await discardUpload(existing);
  }

  const photoId = randomUUID();
  const key = r2Keys.original(guest.eventId, photoId, MIME_EXTENSIONS[input.mimeType]);

  try {
    // The row is created first so the unique sha256 index settles races between guests.
    await prisma.photo.create({
      data: {
        id: photoId,
        eventId: guest.eventId,
        guestId: guest.id,
        originalKey: key,
        originalName: input.filename,
        sizeBytes: input.size,
        mimeType: input.mimeType,
        sha256: input.sha256,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') throw duplicate();
    throw err;
  }

  let uploadId: string;
  try {
    uploadId = await storage.createMultipartUpload(key, input.mimeType);
  } catch (err) {
    await prisma.photo.delete({ where: { id: photoId } });
    throw err;
  }
  await prisma.photo.update({ where: { id: photoId }, data: { uploadId } });

  return { photoId, uploadId, key };
}

async function getOwnUpload(guest: GuestCtx, photoId: string) {
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, eventId: guest.eventId, guestId: guest.id },
  });
  if (!photo) throw notFound('Upload');
  return photo;
}

async function getActiveUpload(guest: GuestCtx, photoId: string) {
  const photo = await getOwnUpload(guest, photoId);
  if (photo.status !== 'UPLOADING' || !photo.uploadId) {
    throw new AppError(409, 'CONFLICT', 'This upload is no longer in progress.');
  }
  return { ...photo, uploadId: photo.uploadId };
}

export async function signPart(guest: GuestCtx, photoId: string, partNumber: number) {
  const photo = await getActiveUpload(guest, photoId);
  const maxParts = Math.ceil(photo.sizeBytes / UPLOAD_PART_SIZE);
  if (partNumber > maxParts) {
    throw new AppError(400, 'BAD_REQUEST', 'Part number exceeds the declared file size.');
  }
  return { url: await storage.presignPart(photo.originalKey, photo.uploadId, partNumber) };
}

export async function listUploadedParts(guest: GuestCtx, photoId: string) {
  const photo = await getActiveUpload(guest, photoId);
  return storage.listParts(photo.originalKey, photo.uploadId);
}

export async function completeUpload(guest: GuestCtx, photoId: string, parts: UploadedPart[]) {
  const photo = await getOwnUpload(guest, photoId);

  // Idempotent: a retry after a dropped response just makes sure the job is queued.
  if (photo.status === 'PROCESSING') {
    await enqueuePhotoProcess({ photoId });
    return { status: photo.status };
  }
  if (photo.status !== 'UPLOADING' || !photo.uploadId) {
    throw new AppError(409, 'CONFLICT', 'This upload is no longer in progress.');
  }

  await storage.completeMultipartUpload(photo.originalKey, photo.uploadId, parts);

  const head = await storage.headObject(photo.originalKey);
  const size = head.ContentLength ?? 0;
  if (size > maxUploadBytes || size === 0) {
    await storage.deleteObject(photo.originalKey);
    await prisma.photo.update({
      where: { id: photo.id },
      data: { status: 'FAILED', sha256: null, uploadId: null },
    });
    throw new AppError(413, 'VALIDATION_ERROR', 'The uploaded file is too large or empty.');
  }

  await prisma.photo.update({
    where: { id: photo.id },
    data: { status: 'PROCESSING', uploadId: null, sizeBytes: size },
  });
  await enqueuePhotoProcess({ photoId });
  return { status: 'PROCESSING' as const };
}

export async function abortUpload(guest: GuestCtx, photoId: string) {
  const photo = await getOwnUpload(guest, photoId);
  if (photo.status !== 'UPLOADING') return;
  await discardUpload(photo);
}

/** Guests can remove their own photos. Soft delete; the cleanup job purges R2 later. */
export async function deleteOwnPhoto(guest: GuestCtx, photoId: string) {
  const photo = await getOwnUpload(guest, photoId);
  if (photo.status === 'UPLOADING') return discardUpload(photo);
  await prisma.photo.update({
    where: { id: photo.id },
    data: { status: 'DELETED', deletedAt: new Date(), sha256: null },
  });
}

export async function listMyPhotos(guest: GuestCtx, query: CursorQuery): Promise<Page<MyPhoto>> {
  const rows = await prisma.photo.findMany({
    where: {
      eventId: guest.eventId,
      guestId: guest.id,
      status: { in: ['PROCESSING', 'READY', 'HIDDEN', 'FAILED'] },
      ...afterCursor(query.cursor),
    },
    orderBy: newestFirst,
    take: query.limit + 1,
  });

  const { page, nextCursor } = toPage(rows, query.limit);
  const items = await Promise.all(
    page.map(async (p) => ({
      id: p.id,
      status: p.status,
      width: p.width,
      height: p.height,
      blurhash: p.blurhash,
      thumbUrl: p.thumbKey ? await storage.signedGetUrl(p.thumbKey) : null,
      displayUrl: p.displayKey ? await storage.signedGetUrl(p.displayKey) : null,
      createdAt: p.createdAt.toISOString(),
    })),
  );

  return { items, nextCursor };
}

/** The shared gallery: READY photos only, derivatives only, never originals. */
export async function listGallery(guest: GuestCtx, query: GalleryQuery): Promise<Page<GalleryPhoto>> {
  await assertGalleryAccess(guest);

  const rows = await prisma.photo.findMany({
    where: {
      eventId: guest.eventId,
      status: 'READY',
      ...(query.featured ? { featured: true } : {}),
      ...afterCursor(query.cursor),
    },
    orderBy: newestFirst,
    take: query.limit + 1,
    include: { guest: { select: { name: true } } },
  });

  const { page, nextCursor } = toPage(rows, query.limit);
  const items = await Promise.all(
    page
      .filter((p) => p.thumbKey && p.displayKey)
      .map(async (p) => ({
        id: p.id,
        width: p.width ?? 1600,
        height: p.height ?? 1200,
        blurhash: p.blurhash,
        thumbUrl: await storage.signedGetUrl(p.thumbKey!),
        displayUrl: await storage.signedGetUrl(p.displayKey!),
        guestName: p.guest.name,
        featured: p.featured,
        takenAt: p.takenAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
  );

  return { items, nextCursor };
}
