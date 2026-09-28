import { useQuery } from '@tanstack/react-query';
import type { PublicEvent } from '@wm/shared';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useEvent(slug: string) {
  return useQuery({
    queryKey: queryKeys.event(slug),
    queryFn: ({ signal }) => api<PublicEvent>(`/events/${encodeURIComponent(slug)}`, { signal }),
    staleTime: 5 * 60_000,
  });
}
