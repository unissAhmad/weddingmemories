import Uppy, { type UppyFile } from '@uppy/core';
import GoldenRetriever from '@uppy/golden-retriever';
import {
  ALLOWED_MIME_TYPES,
  EXTENSION_MIME_TYPES,
  type AllowedMimeType,
  type UploadInitResponse,
} from '@wm/shared';
import { ApiError, api, isApiError } from '@/lib/api';
import { hashFile } from './hashFile';
import CloudinaryUploader, { UploadError, type UploadMeta } from './cloudinaryUploader';

type Body = Record<string, never>;
export type UploaderFile = UppyFile<UploadMeta, Body>;
export type Uploader = Uppy<UploadMeta, Body>;

export interface UploaderCallbacks {
  onDuplicate: (fileId: string) => void;
}

function resolveMimeType(file: UploaderFile): AllowedMimeType {
  const declared = (file.type ?? '').toLowerCase();
  if ((ALLOWED_MIME_TYPES as readonly string[]).includes(declared)) {
    return declared as AllowedMimeType;
  }
  const byExt = EXTENSION_MIME_TYPES[(file.extension ?? '').toLowerCase()];
  if (byExt) return byExt;
  throw new UploadError('Only JPEG, PNG, WebP and HEIC photos are supported.', false);
}

/** Our API errors: 4xx are final (duplicate, too big, uploads closed), the rest are retried. */
function toUploadError(err: unknown): never {
  if (err instanceof ApiError) {
    throw new UploadError(err.message, err.status === 0 || err.status >= 500 || err.status === 429);
  }
  throw err;
}

/**
 * Uppy configured to upload straight to Cloudinary with signatures from our API:
 * - large files go in chunks, each retried with back-off
 * - GoldenRetriever restores the queue after a reload or a locked phone
 * - the file hash is sent first so duplicates are rejected before any bytes move
 */
export function createUploader(
  id: string,
  maxUploadMb: number,
  callbacks: UploaderCallbacks,
): Uploader {
  const uppy = new Uppy<UploadMeta, Body>({
    id,
    autoProceed: true,
    allowMultipleUploadBatches: true,
    restrictions: {
      maxFileSize: maxUploadMb * 1024 * 1024,
      allowedFileTypes: ['image/*', '.heic', '.heif', '.HEIC', '.HEIF'],
    },
  });

  uppy.use(CloudinaryUploader, {
    async init(file) {
      if (!file.data) throw new UploadError('File data is missing', false);
      const mimeType = resolveMimeType(file);
      const sha256 = await hashFile(file.data);
      try {
        return await api<UploadInitResponse>('/photos/uploads', {
          method: 'POST',
          body: { filename: file.name ?? 'photo', mimeType, size: file.size ?? file.data.size, sha256 },
        });
      } catch (err) {
        if (isApiError(err, 'DUPLICATE_PHOTO')) callbacks.onDuplicate(file.id);
        return toUploadError(err);
      }
    },
    async complete(photoId, result) {
      await api(`/photos/${photoId}/complete`, { method: 'POST', body: result }).catch(toUploadError);
    },
    async abort(photoId) {
      await api(`/photos/${photoId}/upload`, { method: 'DELETE' });
    },
  });

  // Persists the queue in IndexedDB so uploads resume after a reload or a locked phone.
  uppy.use(GoldenRetriever, { serviceWorker: false });

  return uppy;
}
