import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SIGNED_URL_TTL_SECONDS, type UploadedPart } from '@wm/shared';
import { env } from '../env';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: Boolean(env.R2_ENDPOINT),
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  // R2 rejects the default CRC32 checksums newer SDK versions add to presigned part uploads.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const Bucket = env.R2_BUCKET;
const PART_URL_TTL_SECONDS = 60 * 60;

export async function createMultipartUpload(key: string, contentType: string) {
  const res = await r2.send(
    new CreateMultipartUploadCommand({ Bucket, Key: key, ContentType: contentType }),
  );
  if (!res.UploadId) throw new Error('R2 did not return an UploadId');
  return res.UploadId;
}

export function presignPart(key: string, uploadId: string, partNumber: number) {
  return getSignedUrl(
    r2,
    new UploadPartCommand({ Bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: PART_URL_TTL_SECONDS },
  );
}

export async function listParts(key: string, uploadId: string): Promise<UploadedPart[]> {
  const parts: UploadedPart[] = [];
  let marker: string | undefined;
  do {
    const res = await r2.send(
      new ListPartsCommand({ Bucket, Key: key, UploadId: uploadId, PartNumberMarker: marker }),
    );
    for (const p of res.Parts ?? []) {
      if (p.PartNumber && p.ETag) {
        parts.push({ PartNumber: p.PartNumber, ETag: p.ETag, Size: p.Size ?? 0 });
      }
    }
    marker = res.IsTruncated ? res.NextPartNumberMarker : undefined;
  } while (marker);
  return parts;
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: UploadedPart[],
) {
  const sorted = [...parts]
    .sort((a, b) => a.PartNumber - b.PartNumber)
    .map(({ PartNumber, ETag }) => ({ PartNumber, ETag }));
  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: sorted },
    }),
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  await r2.send(new AbortMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId }));
}

export async function headObject(key: string) {
  return r2.send(new HeadObjectCommand({ Bucket, Key: key }));
}

export async function deleteObject(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

/** Presigned single-request PUT, used for small admin uploads such as the cover image. */
export function presignPut(key: string, contentType: string, expiresIn = 15 * 60) {
  return getSignedUrl(r2, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }), {
    expiresIn,
  });
}

/** Signed URL that makes the browser download the file under `filename`. */
export function signedDownloadUrl(key: string, filename: string, expiresIn: number) {
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    }),
    { expiresIn: Math.max(60, Math.floor(expiresIn)) },
  );
}

/**
 * Signed GET URL. The signing time is rounded down to a 30-minute window so the
 * same URL is returned for repeated requests, which lets browsers cache images.
 * Every URL stays valid for between 1 and 1.5 hours.
 */
export function signedGetUrl(key: string) {
  const windowMs = 30 * 60 * 1000;
  const signingDate = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  return getSignedUrl(r2, new GetObjectCommand({ Bucket, Key: key }), {
    expiresIn: SIGNED_URL_TTL_SECONDS + windowMs / 1000,
    signingDate,
  });
}
