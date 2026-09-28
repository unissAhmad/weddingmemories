import Uppy, { type UppyFile } from '@uppy/core';
import AwsS3, { type AwsS3Part } from '@uppy/aws-s3';
import GoldenRetriever from '@uppy/golden-retriever';
import {
  ALLOWED_MIME_TYPES,
  EXTENSION_MIME_TYPES,
  UPLOAD_PART_SIZE,
  photoIdFromKey,
  type AllowedMimeType,
  type UploadInitResponse,
} from '@wm/shared';
import { ApiError, api, isApiError } from '@/lib/api';
import { hashFile } from './hashFile';

type Meta = Record<string, never>;
type Body = Record<string, never>;
export type UploaderFile = UppyFile<Meta, Body>;
export type Uploader = Uppy<Meta, Body>;

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
  throw new ApiError(400, 'VALIDATION_ERROR', 'Only JPEG, PNG, WebP and HEIC photos are supported.');
}

function photoId(key: string) {
  const id = photoIdFromKey(key);
  if (!id) throw new Error(`Unexpected upload key: ${key}`);
  return id;
}

/**
 * Uppy configured for resumable multipart uploads straight to R2:
 * - parts are retried with back-off, and GoldenRetriever restores the queue after a reload
 * - the file hash is sent first so duplicates are rejected before any bytes move
 */
export function createUploader(
  id: string,
  maxUploadMb: number,
  callbacks: UploaderCallbacks,
): Uploader {
  const uppy = new Uppy<Meta, Body>({
    id,
    autoProceed: true,
    allowMultipleUploadBatches: true,
    restrictions: {
      maxFileSize: maxUploadMb * 1024 * 1024,
      allowedFileTypes: ['image/*', '.heic', '.heif', '.HEIC', '.HEIF'],
    },
  });

  uppy.use(AwsS3<Meta, Body>, {
    shouldUseMultipart: true,
    limit: 3,
    retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000],
    getChunkSize: () => UPLOAD_PART_SIZE,

    async createMultipartUpload(file) {
      if (!file.data) throw new Error('File data is missing');
      const mimeType = resolveMimeType(file);
      const sha256 = await hashFile(file.data);
      try {
        const res = await api<UploadInitResponse>('/photos/uploads', {
          method: 'POST',
          body: { filename: file.name ?? 'photo', mimeType, size: file.size ?? file.data.size, sha256 },
        });
        return { uploadId: res.uploadId, key: res.key };
      } catch (err) {
        if (isApiError(err, 'DUPLICATE_PHOTO')) callbacks.onDuplicate(file.id);
        throw err;
      }
    },

    async signPart(_file, { key, partNumber, signal }) {
      const { url } = await api<{ url: string }>(`/photos/${photoId(key)}/parts/${partNumber}`, {
        signal,
      });
      return { method: 'PUT', url };
    },

    listParts(_file, { key, signal }) {
      return api<AwsS3Part[]>(`/photos/${photoId(key)}/parts`, { signal });
    },

    async completeMultipartUpload(_file, { key, parts, signal }) {
      await api(`/photos/${photoId(key)}/complete`, {
        method: 'POST',
        body: { parts: parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag })) },
        signal,
      });
      return {};
    },

    async abortMultipartUpload(_file, { key, signal }) {
      await api(`/photos/${photoId(key)}/upload`, { method: 'DELETE', signal });
    },
  });

  // Persists the queue in IndexedDB so uploads resume after a reload or a locked phone.
  uppy.use(GoldenRetriever, { serviceWorker: false });

  return uppy;
}
