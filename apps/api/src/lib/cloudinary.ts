import { timingSafeEqual } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import type { SignedUpload } from '@wm/shared';
import { env } from '../env';

const { hostname: cloudName, username, password } = new URL(env.CLOUDINARY_URL);
const apiKey = decodeURIComponent(username);
const apiSecret = decodeURIComponent(password);

cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

/**
 * Every asset is uploaded as "authenticated": nothing can be fetched without a URL signed with
 * our API secret, and each signature covers one exact transformation. Guests only ever get
 * signatures for resized renditions, so they can't derive a URL for the original.
 */
const DELIVERY_TYPE = 'authenticated';

const PHOTO_FORMATS = 'jpg,jpeg,png,webp,heic,heif';

export function signUpload(publicId: string, opts: { formats?: string } = {}): SignedUpload {
  const params: Record<string, string> = {
    public_id: publicId,
    type: DELIVERY_TYPE,
    overwrite: 'false',
    allowed_formats: opts.formats ?? PHOTO_FORMATS,
    image_metadata: 'true',
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  const signature = cloudinary.utils.api_sign_request(params, apiSecret);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    params: { ...params, api_key: apiKey, signature },
  };
}

/** Cloudinary signs every upload response: sha1("public_id=…&version=…" + secret). */
export function verifyUploadResponse(publicId: string, version: string, signature: string) {
  const expected = cloudinary.utils.api_sign_request({ public_id: publicId, version }, apiSecret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Signed delivery URL for one transformation of an authenticated asset. */
export function deliveryUrl(publicId: string, transformation: string) {
  return cloudinary.url(publicId, {
    type: DELIVERY_TYPE,
    sign_url: true,
    secure: true,
    raw_transformation: transformation,
  });
}

/** Time-limited URL for the untouched original file (admin ZIP downloads only). */
export function originalDownloadUrl(publicId: string, format: string, ttlSeconds = 3600) {
  return cloudinary.utils.private_download_url(publicId, format, {
    type: DELIVERY_TYPE,
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
}

export async function destroyAsset(publicId: string) {
  await cloudinary.uploader.destroy(publicId, { type: DELIVERY_TYPE, invalidate: true });
}
