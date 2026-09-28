import type { Readable } from 'node:stream';
import {
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env';

export const r2 = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: Boolean(env.R2_ENDPOINT),
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const Bucket = env.R2_BUCKET;

/** Originals are capped at MAX_UPLOAD_MB, so buffering one in memory is fine. */
export async function getObjectBuffer(key: string) {
  const res = await r2.send(new GetObjectCommand({ Bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty body for ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function getObjectStream(key: string) {
  const res = await r2.send(new GetObjectCommand({ Bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty body for ${key}`);
  return res.Body as Readable;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await r2.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Derivatives never change once written (a new photo gets a new id).
      CacheControl: 'private, max-age=31536000, immutable',
    }),
  );
}

/** Streams `body` into R2 as a multipart upload without buffering the whole thing. */
export function streamUpload(key: string, body: Readable, contentType: string) {
  return new Upload({
    client: r2,
    params: { Bucket, Key: key, Body: body, ContentType: contentType },
    partSize: 16 * 1024 * 1024,
    queueSize: 2,
  });
}

export async function deleteObject(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  await r2.send(new AbortMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId }));
}

export function signedDownloadUrl(key: string, filename: string, expiresIn: number) {
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    }),
    { expiresIn },
  );
}
