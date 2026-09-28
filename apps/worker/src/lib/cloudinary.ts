import { v2 as cloudinary } from 'cloudinary';
import { env } from '../env';

const { hostname: cloudName, username, password } = new URL(env.CLOUDINARY_URL);

cloudinary.config({
  cloud_name: cloudName,
  api_key: decodeURIComponent(username),
  api_secret: decodeURIComponent(password),
  secure: true,
});

// Same delivery type as the API: every URL must be signed for its exact transformation.
const DELIVERY_TYPE = 'authenticated';

export function deliveryUrl(publicId: string, transformation: string) {
  return cloudinary.url(publicId, {
    type: DELIVERY_TYPE,
    sign_url: true,
    secure: true,
    raw_transformation: transformation,
  });
}

export async function destroyAsset(publicId: string) {
  const res = (await cloudinary.uploader.destroy(publicId, { type: DELIVERY_TYPE, invalidate: true })) as {
    result?: string;
  };
  // "not found" is fine: the goal is that the asset is gone.
  if (res.result !== 'ok' && res.result !== 'not found') {
    throw new Error(`Cloudinary destroy failed for ${publicId}: ${res.result}`);
  }
}
