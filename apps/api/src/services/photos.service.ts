import { randomUUID } from 'node:crypto';
import {
  TRANSFORMS,
  publicIds,
  type CursorQuery,
  type GalleryPhoto,
  type GalleryQuery,
  type MyPhoto,
  type Page,
  type UploadComplete,
  type UploadInit,
  type UploadInitResponse,
} from '@wm/shared';
import { Prisma, prisma } from '../lib/prisma';
import { AppError, notFound } from '../lib/errors';
import { deliveryUrl, destroyAsset, signUpload, verifyUploadResponse } from '../lib/cloudinary';
import { enqueuePhotoProcess } from '../lib/queue';
import { logger } from '../lib/logger';
import { env, maxUploadBytes } from '../env';
import { afterCursor, newestFirst, toPage } from '../lib/cursor';
import { getEventById } from './events.service';
import { assertGalleryAccess } from './access.service';
import { visibleGuest } from './social.service';

type GuestCtx = { id: string; eventId: string };

const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

const duplicate = () =>
  new AppError(409, 'DUPLICATE_PHOTO', 'This photo has already been shared.');

/** Removes an unfinished upload. The asset may or may not have reached Cloudinary. */
async function discardUpload(photo: { id: string; publicId: string }) {
  await destroyAsset(photo.publicId).catch((err) => {
    logger.warn({ err, photoId: photo.id }, 'cloudinary destroy failed');
  });
  await prisma.photo.delete({ where: { id: photo.id } });
}

export async function initUpload(guest: GuestCtx, input: UploadInit): Promise<UploadInitResponse> {
  const event = await getEventById(guest.eventId);
  if (!event.settings.uploadsOpen) {
    throw new AppError(403, 'UPLOADS_CLOSED', 'Uploads are closed for this event.');
  }
  if (input.size > maxUploadBytes) {
    throw new AppError(413, 'VALIDATION_ERROR', `Photos must be ${env.MAX_UPLOAD_MB} MB or smaller.`);
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
  const publicId = publicIds.original(env.CLOUDINARY_FOLDER, guest.eventId, photoId);

  try {
    // The unique sha256 index settles races between guests uploading the same file.
    await prisma.photo.create({
      data: {
        id: photoId,
        eventId: guest.eventId,
        guestId: guest.id,
        publicId,
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

  return { photoId, ...signUpload(publicId) };
}

async function getOwnUpload(guest: GuestCtx, photoId: string) {
  const photo = await prisma.photo.findFirst({
    where: { id: photoId, eventId: guest.eventId, guestId: guest.id },
  });
  if (!photo) throw notFound('Upload');
  return photo;
}

/** EXIF "2026:12:12 16:30:15" → Date. Only used for ordering and ZIP file names. */
function parseTakenAt(meta: Record<string, unknown> | undefined): Date | null {
  const raw = meta?.DateTimeOriginal ?? meta?.CreateDate;
  if (typeof raw !== 'string') return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!));
  const year = d.getUTCFullYear();
  return Number.isNaN(d.getTime()) || year < 2000 || year > 2100 ? null : d;
}

/** Called by the browser with Cloudinary's upload response once the file is stored. */
export async function completeUpload(guest: GuestCtx, photoId: string, result: UploadComplete) {
  const photo = await getOwnUpload(guest, photoId);

  // Idempotent: a retry after a dropped response just makes sure the job is queued.
  if (photo.status === 'PROCESSING') {
    await enqueuePhotoProcess({ photoId });
    return { status: photo.status };
  }
  if (photo.status !== 'UPLOADING') {
    throw new AppError(409, 'CONFLICT', 'This upload is no longer in progress.');
  }

  // The signature proves Cloudinary stored exactly this asset for us.
  if (result.public_id !== photo.publicId || !verifyUploadResponse(result.public_id, result.version, result.signature)) {
    throw new AppError(400, 'BAD_REQUEST', 'Upload could not be verified. Please try again.');
  }

  const size = result.bytes ?? photo.sizeBytes;
  if (size > maxUploadBytes) {
    await destroyAsset(photo.publicId).catch(() => {});
    await prisma.photo.update({ where: { id: photo.id }, data: { status: 'FAILED', sha256: null } });
    throw new AppError(413, 'VALIDATION_ERROR', `Photos must be ${env.MAX_UPLOAD_MB} MB or smaller.`);
  }

  await prisma.photo.update({
    where: { id: photo.id },
    data: {
      status: 'PROCESSING',
      sizeBytes: size,
      format: result.format ?? null,
      takenAt: parseTakenAt(result.image_metadata),
    },
  });
  await enqueuePhotoProcess({ photoId });
  return { status: 'PROCESSING' as const };
}

export async function abortUpload(guest: GuestCtx, photoId: string) {
  const photo = await getOwnUpload(guest, photoId);
  if (photo.status !== 'UPLOADING') return;
  await discardUpload(photo);
}

/** Guests can remove their own photos. Soft delete; the cleanup job purges Cloudinary later. */
export async function deleteOwnPhoto(guest: GuestCtx, photoId: string) {
  const photo = await getOwnUpload(guest, photoId);
  if (photo.status === 'UPLOADING') return discardUpload(photo);
  await prisma.photo.update({
    where: { id: photo.id },
    data: { status: 'DELETED', deletedAt: new Date(), sha256: null },
  });
}

// Cloudinary renders thumbnails on demand, so a photo can be shown as soon as it's stored.
const VIEWABLE = new Set(['PROCESSING', 'READY', 'HIDDEN']);

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
  const items = page.map((p) => {
    const viewable = VIEWABLE.has(p.status);
    return {
      id: p.id,
      status: p.status,
      width: p.width,
      height: p.height,
      blurhash: p.blurhash,
      thumbUrl: viewable ? deliveryUrl(p.publicId, TRANSFORMS.thumb) : null,
      displayUrl: viewable ? deliveryUrl(p.publicId, TRANSFORMS.display) : null,
      createdAt: p.createdAt.toISOString(),
    };
  });

  return { items, nextCursor };
}

/**
 * Ranked tabs page by position: counts change while people browse, so a date cursor doesn't
 * apply. The cursor is "o:<offset>".
 */
function rankedOrder(sort: 'liked' | 'trending'): Prisma.PhotoOrderByWithRelationInput[] {
  const newest: Prisma.PhotoOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];
  return sort === 'liked'
    ? [{ likes: { _count: 'desc' } }, ...newest]
    : [{ comments: { _count: 'desc' } }, { likes: { _count: 'desc' } }, ...newest];
}

function parseOffset(cursor?: string) {
  if (!cursor) return 0;
  const n = Number(/^o:(\d+)$/.exec(cursor)?.[1]);
  if (!Number.isInteger(n) || n < 0) throw new AppError(400, 'BAD_REQUEST', 'Invalid cursor');
  return n;
}

/** The shared gallery: READY photos only, resized renditions only, never originals. */
export async function listGallery(guest: GuestCtx, query: GalleryQuery): Promise<Page<GalleryPhoto>> {
  await assertGalleryAccess(guest);

  const ranked = !query.featured && query.sort !== 'latest';
  const sort = query.sort as 'liked' | 'trending';
  const offset = ranked ? parseOffset(query.cursor) : 0;

  const rows = await prisma.photo.findMany({
    where: {
      eventId: guest.eventId,
      status: 'READY',
      ...(query.featured ? { featured: true } : {}),
      // Ranked tabs only list photos someone has reacted to.
      ...(ranked && sort === 'liked' ? { likes: { some: visibleGuest } } : {}),
      ...(ranked && sort === 'trending' ? { comments: { some: visibleGuest } } : {}),
      ...(ranked ? {} : afterCursor(query.cursor)),
    },
    orderBy: ranked ? rankedOrder(sort) : newestFirst,
    ...(ranked ? { skip: offset } : {}),
    take: query.limit + 1,
    include: {
      guest: { select: { name: true } },
      _count: { select: { likes: { where: visibleGuest }, comments: { where: visibleGuest } } },
      likes: { where: { guestId: guest.id }, select: { guestId: true }, take: 1 },
    },
  });

  const { page, nextCursor: dateCursor } = toPage(rows, query.limit);
  const nextCursor = ranked ? (rows.length > query.limit ? `o:${offset + query.limit}` : null) : dateCursor;

  const items = page.map((p) => ({
    id: p.id,
    width: p.width ?? 1600,
    height: p.height ?? 1200,
    blurhash: p.blurhash,
    thumbUrl: deliveryUrl(p.publicId, TRANSFORMS.thumb),
    displayUrl: deliveryUrl(p.publicId, TRANSFORMS.display),
    guestName: p.guest.name,
    featured: p.featured,
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    likedByMe: p.likes.length > 0,
    takenAt: p.takenAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  return { items, nextCursor };
}
