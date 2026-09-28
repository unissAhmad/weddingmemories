import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GuestMe } from '@wm/shared';
import { api, isApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** The signed-in guest, or null when there is no valid session. */
export function useMe(opts: { refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => {
      try {
        return await api<GuestMe>('/guest/me', { signal });
      } catch (err) {
        if (isApiError(err) && (err.status === 401 || err.code === 'GUEST_BLOCKED')) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    refetchInterval: opts.refetchInterval,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/guest/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.setQueryData(queryKeys.me, null);
      qc.removeQueries({ queryKey: ['photos'] });
    },
  });
}
