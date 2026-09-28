import type { Request, RequestHandler } from 'express';
import type { AdminRole } from '@wm/shared';
import { prisma } from '../lib/prisma';
import { AppError, forbidden, notFound, unauthorized } from '../lib/errors';
import { verifyAdminToken } from '../lib/jwt';
import { ADMIN_COOKIE, clearAdminCookies } from '../lib/cookies';

export interface AdminCtx {
  id: string;
  email: string;
  role: AdminRole;
}

/** Loads the admin on every request so removed admins lose access immediately. */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  const token: unknown = req.cookies?.[ADMIN_COOKIE];
  const adminId = typeof token === 'string' ? await verifyAdminToken(token) : null;
  if (!adminId) throw unauthorized('Please sign in to the admin panel');

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, role: true, totpEnabledAt: true },
  });
  if (!admin || !admin.totpEnabledAt) {
    clearAdminCookies(res);
    throw unauthorized('Please sign in to the admin panel');
  }

  req.admin = { id: admin.id, email: admin.email, role: admin.role };
  next();
};

export const requireOwner: RequestHandler = (req, _res, next) => {
  if (req.admin?.role !== 'OWNER') throw forbidden('Only the owner can do this');
  next();
};

/**
 * Scopes every /events/:eventId route. Owners can open any event; moderators only the events
 * they were assigned to. Unassigned events look like they don't exist.
 */
export const requireEventAccess: RequestHandler = async (req, _res, next) => {
  const admin = currentAdmin(req);
  const eventId = String(req.params.eventId ?? '');
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      ...(admin.role === 'OWNER' ? {} : { admins: { some: { adminId: admin.id } } }),
    },
    select: { id: true, slug: true, name: true },
  });
  if (!event) throw notFound('Event');
  req.adminEvent = event;
  next();
};

export function currentAdmin(req: Request): AdminCtx {
  if (!req.admin) throw unauthorized();
  return req.admin;
}

export function currentEvent(req: Request) {
  if (!req.adminEvent) throw new AppError(500, 'INTERNAL', 'Event scope missing');
  return req.adminEvent;
}
