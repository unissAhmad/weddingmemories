import type { RequestHandler } from 'express';
import { CSRF_HEADER } from '@wm/shared';
import { AppError } from '../lib/errors';
import { webOrigins } from '../env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated mutations:
 * 1. A custom header is required. Browsers can't send it cross-origin without a CORS
 *    preflight, and CORS only allows our web origin.
 * 2. If the browser sends an Origin header, it must be one of ours.
 */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const origin = req.get('origin');
  if (origin && !webOrigins.includes(origin)) {
    return next(new AppError(403, 'CSRF', 'Cross-site request blocked'));
  }
  if (req.get(CSRF_HEADER) !== '1') {
    return next(new AppError(403, 'CSRF', 'Missing CSRF header'));
  }
  next();
};
