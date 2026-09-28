import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '../env';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Hash for low-entropy shared secrets such as the family code. Format: scrypt$salt$hash */
export async function hashSecret(secret: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(normalize(secret), salt, 32);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifySecret(secret: string, stored: string) {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scryptAsync(normalize(secret), Buffer.from(salt, 'base64url'), expected.length);
  return timingSafeEqual(expected, actual);
}

/** Family codes are typed on phones: ignore case and surrounding spaces. */
const normalize = (s: string) => s.trim().toLowerCase();

const encKey = createHash('sha256').update(`totp:${env.JWT_SECRET_ADMIN}`).digest();

/** AES-256-GCM for secrets we must read back (TOTP seeds). Format: iv.tag.ciphertext */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload: string) {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Malformed encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', encKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
