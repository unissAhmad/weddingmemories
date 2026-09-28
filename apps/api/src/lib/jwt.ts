import { SignJWT, jwtVerify } from 'jose';
import { GUEST_SESSION_DAYS } from '@wm/shared';
import { env } from '../env';

const guestSecret = new TextEncoder().encode(env.JWT_SECRET_GUEST);
const adminSecret = new TextEncoder().encode(env.JWT_SECRET_ADMIN);

const GUEST_AUDIENCE = 'wm:guest';
const ADMIN_PRE_AUDIENCE = 'wm:admin-pre';
const ADMIN_AUDIENCE = 'wm:admin';

export const ADMIN_SESSION_HOURS = 8;
export const ADMIN_PRE_AUTH_MINUTES = 10;

export interface GuestClaims {
  guestId: string;
  eventId: string;
}

export function signGuestToken({ guestId, eventId }: GuestClaims) {
  return new SignJWT({ eid: eventId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(guestId)
    .setAudience(GUEST_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${GUEST_SESSION_DAYS}d`)
    .sign(guestSecret);
}

export async function verifyGuestToken(token: string): Promise<GuestClaims | null> {
  try {
    const { payload } = await jwtVerify(token, guestSecret, {
      audience: GUEST_AUDIENCE,
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string' || typeof payload.eid !== 'string') return null;
    return { guestId: payload.sub, eventId: payload.eid };
  } catch {
    return null;
  }
}

/**
 * Admin tokens: a short pre-auth token after the password step, and the session token after
 * TOTP. They use different audiences so a pre-auth token can never act as a session.
 */
function signAdmin(adminId: string, audience: string, ttl: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(adminId)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(adminSecret);
}

async function verifyAdmin(token: string, audience: string) {
  try {
    const { payload } = await jwtVerify(token, adminSecret, { audience, algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export const signAdminPreToken = (adminId: string) =>
  signAdmin(adminId, ADMIN_PRE_AUDIENCE, `${ADMIN_PRE_AUTH_MINUTES}m`);
export const verifyAdminPreToken = (token: string) => verifyAdmin(token, ADMIN_PRE_AUDIENCE);

/**
 * ZIP part links. The browser opens them directly (no cookie reaches the API across a proxy),
 * so the link itself is the credential: one download job, one slice of its photos.
 */
const ZIP_AUDIENCE = 'wm:zip';

export interface ZipPartClaims {
  jobId: string;
  /** Slice of the job's photo snapshot: [from, to) */
  from: number;
  to: number;
  /** 0-based part number and total, for the file name */
  part: number;
  parts: number;
}

export function signZipToken(claims: ZipPartClaims, expiresAt: Date) {
  const { jobId, ...rest } = claims;
  return new SignJWT({ ...rest })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(jobId)
    .setAudience(ZIP_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(adminSecret);
}

export async function verifyZipToken(token: string): Promise<ZipPartClaims | null> {
  try {
    const { payload } = await jwtVerify(token, adminSecret, { audience: ZIP_AUDIENCE, algorithms: ['HS256'] });
    const { sub, from, to, part, parts } = payload;
    const nums = [from, to, part, parts];
    if (typeof sub !== 'string' || !nums.every((n) => typeof n === 'number')) return null;
    return { jobId: sub, from: from as number, to: to as number, part: part as number, parts: parts as number };
  } catch {
    return null;
  }
}

export const signAdminToken = (adminId: string) =>
  signAdmin(adminId, ADMIN_AUDIENCE, `${ADMIN_SESSION_HOURS}h`);
export const verifyAdminToken = (token: string) => verifyAdmin(token, ADMIN_AUDIENCE);
