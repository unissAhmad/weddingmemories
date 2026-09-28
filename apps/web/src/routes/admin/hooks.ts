import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router';
import type { AdminEventDetail, AdminEventSummary, AdminMe } from '@wm/shared';
import { api, isApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useAdminMe() {
  return useQuery({
    queryKey: queryKeys.admin.me,
    queryFn: async ({ signal }) => {
      try {
        return await api<AdminMe>('/admin/me', { signal });
      } catch (err) {
        if (isApiError(err) && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
  });
}

export function useAdminEvents(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.events,
    queryFn: ({ signal }) => api<AdminEventSummary[]>('/admin/events', { signal }),
    enabled,
  });
}

export interface AdminEventContext {
  me: AdminMe;
  event: AdminEventDetail;
  isOwner: boolean;
  /** API path prefix for this event, e.g. /admin/events/abc */
  base: string;
}

export const useAdminEventContext = () => useOutletContext<AdminEventContext>();

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
