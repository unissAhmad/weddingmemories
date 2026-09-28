import type { AdminRole } from '@wm/shared';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireGuest */
      guest?: { id: string; eventId: string; name: string };
      /** Set by requireAdmin */
      admin?: { id: string; email: string; role: AdminRole };
      /** Set by requireEventAccess */
      adminEvent?: { id: string; slug: string; name: string };
      /** Set by validate(): parsed body/query/params */
      valid: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
