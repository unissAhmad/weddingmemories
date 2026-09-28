import { useInfiniteQuery } from '@tanstack/react-query';
import type { MyPhoto, Page } from '@wm/shared';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useMyPhotos(eventId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.myPhotos(eventId),
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ limit: '30' });
      if (pageParam) qs.set('cursor', pageParam);
      return api<Page<MyPhoto>>(`/photos/mine?${qs}`, { signal });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Poll while the worker is still turning uploads into thumbnails.
    refetchInterval: (query) => {
      const pending = query.state.data?.pages.some((p) =>
        p.items.some((photo) => photo.status === 'PROCESSING'),
      );
      return pending ? 4000 : false;
    },
  });
}
