import type { Prisma } from '@wm/db';
import { prisma } from './prisma';

interface AuditInput {
  adminId: string;
  eventId?: string | null;
  action: string;
  targetId?: string | null;
  meta?: Prisma.InputJsonValue;
}

/** Every admin mutation calls this. Pass `tx` to write inside the same transaction. */
export function audit(entry: AuditInput, tx: Pick<typeof prisma, 'auditLog'> = prisma) {
  return tx.auditLog.create({
    data: {
      adminId: entry.adminId,
      eventId: entry.eventId ?? null,
      action: entry.action,
      targetId: entry.targetId ?? null,
      meta: entry.meta,
    },
  });
}
