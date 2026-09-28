import type { CookieOptions, Response } from 'express';
import { GUEST_SESSION_DAYS } from '@wm/shared';
import { env, isProd } from '../env';
import { ADMIN_PRE_AUTH_MINUTES, ADMIN_SESSION_HOURS } from './jwt';

export const GUEST_COOKIE = 'wm_guest';
export const ADMIN_COOKIE = 'wm_admin';
export const ADMIN_PRE_COOKIE = 'wm_admin_pre';

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};

// Admin cookies are only ever sent to admin endpoints.
const adminOptions: CookieOptions = { ...baseOptions, path: '/api/admin', sameSite: 'strict' };

export function setGuestCookie(res: Response, token: string) {
  res.cookie(GUEST_COOKIE, token, {
    ...baseOptions,
    maxAge: GUEST_SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearGuestCookie(res: Response) {
  res.clearCookie(GUEST_COOKIE, baseOptions);
}

export function setAdminPreCookie(res: Response, token: string) {
  res.cookie(ADMIN_PRE_COOKIE, token, { ...adminOptions, maxAge: ADMIN_PRE_AUTH_MINUTES * 60_000 });
}

export function setAdminCookie(res: Response, token: string) {
  res.clearCookie(ADMIN_PRE_COOKIE, adminOptions);
  res.cookie(ADMIN_COOKIE, token, { ...adminOptions, maxAge: ADMIN_SESSION_HOURS * 3_600_000 });
}

export function clearAdminCookies(res: Response) {
  res.clearCookie(ADMIN_PRE_COOKIE, adminOptions);
  res.clearCookie(ADMIN_COOKIE, adminOptions);
}
