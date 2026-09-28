import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, unauthorized } from '../lib/errors';
import { verifyGuestToken } from '../lib/jwt';
import { GUEST_COOKIE, clearGuestCookie } from '../lib/cookies';

/** Loads the guest on every request so blocking takes effect immediately. */
export const requireGuest: RequestHandler = async (req, res, next) => {
  const token: unknown = req.cookies?.[GUEST_COOKIE];
  const claims = typeof token === 'string' ? await verifyGuestToken(token) : null;
  if (!claims) throw unauthorized();

  const guest = await prisma.guest.findFirst({
    where: { id: claims.guestId, eventId: claims.eventId },
    select: { id: true, eventId: true, name: true, blocked: true },
  });
  if (!guest) {
    clearGuestCookie(res);
    throw unauthorized();
  }
  if (guest.blocked) {
    throw new AppError(403, 'GUEST_BLOCKED', 'Your access to this event has been removed.');
  }

  req.guest = { id: guest.id, eventId: guest.eventId, name: guest.name };
  next();
};

export function currentGuest(req: Parameters<RequestHandler>[0]) {
  if (!req.guest) throw unauthorized();
  return req.guest;
}
