export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MIME_EXTENSIONS: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** Some browsers report an empty type for HEIC files; fall back to the extension. */
export const EXTENSION_MIME_TYPES: Record<string, AllowedMimeType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/** S3/R2 minimum part size (except the last part). */
export const UPLOAD_PART_SIZE = 5 * 1024 * 1024;

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

export const GUEST_SESSION_DAYS = 30;
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const PAGE_LIMIT_DEFAULT = 30;
export const PAGE_LIMIT_MAX = 60;

export const QUEUES = {
  photoProcess: 'photo.process',
  zipBuild: 'zip.build',
  cleanup: 'maintenance.cleanup',
} as const;

/**
 * pg-boss queue settings, shared by the API (which sends jobs) and the worker (which runs them)
 * so it doesn't matter which process creates a queue first.
 */
export const QUEUE_DEFINITIONS = [
  { name: QUEUES.photoProcess, retryLimit: 3, retryDelay: 30, retryBackoff: true, expireInSeconds: 5 * 60 },
  { name: QUEUES.zipBuild, retryLimit: 1, retryDelay: 60, expireInSeconds: 3 * 60 * 60 },
  { name: QUEUES.cleanup, retryLimit: 0, expireInSeconds: 15 * 60 },
] as const;

/** Split ZIP downloads into parts of about this size. */
export const ZIP_PART_BYTES = 2 * 1024 * 1024 * 1024;
export const ZIP_LINK_TTL_HOURS = 24;
/** Soft-deleted photos stay restorable for this long before R2 is purged. */
export const DELETED_PHOTO_RETENTION_DAYS = 7;

/** Header required on every mutating request; custom headers force a CORS preflight. */
export const CSRF_HEADER = 'x-wm-csrf';
