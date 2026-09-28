import argon2 from 'argon2';
import type { AdminTeamMember, AuditEntry, CreateAdmin, Page } from '@wm/shared';
import { Prisma, prisma } from '../../lib/prisma';
import { AppError, notFound } from '../../lib/errors';
import { afterCursor, newestFirst, toPage } from '../../lib/cursor';
import { audit } from '../../lib/audit';
import type { AdminCtx } from '../../middleware/requireAdmin';

export async function listTeam(): Promise<AdminTeamMember[]> {
  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: 'asc' },
    include: { events: { select: { eventId: true } } },
  });
  return admins.map((a) => ({
    id: a.id,
    email: a.email,
    role: a.role,
    twoFactor: a.totpEnabledAt !== null,
    eventIds: a.events.map((e) => e.eventId),
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function createTeamMember(actor: AdminCtx, input: CreateAdmin) {
  try {
    const admin = await prisma.admin.create({
      data: {
        email: input.email,
        passwordHash: await argon2.hash(input.password),
        role: input.role,
        events: { create: input.eventIds.map((eventId) => ({ eventId })) },
      },
    });
    await audit({
      adminId: actor.id,
      action: 'team.create',
      targetId: admin.id,
      meta: { email: admin.email, role: admin.role, eventIds: input.eventIds },
    });
    return { id: admin.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') throw new AppError(409, 'CONFLICT', 'An admin with that email exists.');
      if (err.code === 'P2003') throw new AppError(400, 'BAD_REQUEST', 'Unknown event.');
    }
    throw err;
  }
}

async function getOther(actor: AdminCtx, adminId: string) {
  if (adminId === actor.id) throw new AppError(400, 'BAD_REQUEST', "You can't change your own account here.");
  const target = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!target) throw notFound('Admin');
  return target;
}

export async function removeTeamMember(actor: AdminCtx, adminId: string) {
  const target = await getOther(actor, adminId);
  await prisma.admin.delete({ where: { id: target.id } });
  await audit({ adminId: actor.id, action: 'team.remove', targetId: target.id, meta: { email: target.email } });
}

/** For a lost phone: the admin enrols a new authenticator at their next sign-in. */
export async function resetTwoFactor(actor: AdminCtx, adminId: string) {
  const target = await getOther(actor, adminId);
  await prisma.admin.update({
    where: { id: target.id },
    data: { totpSecret: null, totpEnabledAt: null },
  });
  await audit({ adminId: actor.id, action: 'team.reset_2fa', targetId: target.id, meta: { email: target.email } });
}

export async function listAudit(
  eventId: string,
  query: { cursor?: string; limit: number },
): Promise<Page<AuditEntry>> {
  const rows = await prisma.auditLog.findMany({
    where: { AND: [{ OR: [{ eventId }, { eventId: null }] }, afterCursor(query.cursor)] },
    orderBy: newestFirst,
    take: query.limit + 1,
  });
  const { page, nextCursor } = toPage(rows, query.limit);

  const admins = await prisma.admin.findMany({
    where: { id: { in: [...new Set(page.map((r) => r.adminId))] } },
    select: { id: true, email: true },
  });
  const emails = new Map(admins.map((a) => [a.id, a.email]));

  return {
    items: page.map((r) => ({
      id: r.id,
      adminEmail: emails.get(r.adminId) ?? null,
      action: r.action,
      targetId: r.targetId,
      meta: r.meta,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
  };
}
