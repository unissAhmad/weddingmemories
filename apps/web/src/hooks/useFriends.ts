import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Friend, FriendWithPreview, Page } from '@wm/shared';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** Guests who have shared photos, each with their newest few. */
export function useFriends(eventId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.friends(eventId),
    queryFn: ({ pageParam, signal }) =>
      api<Page<FriendWithPreview>>(`/friends${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, {
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Signed URLs last at least an hour; refresh well before that.
    staleTime: 5 * 60_000,
  });
}

export function useFriend(eventId: string, guestId: string) {
  return useQuery({
    queryKey: queryKeys.friend(eventId, guestId),
    queryFn: ({ signal }) => api<Friend>(`/friends/${encodeURIComponent(guestId)}`, { signal }),
  });
}
