import { useInfiniteQuery } from '@tanstack/react-query';
import type { GalleryPhoto, GallerySort, Page } from '@wm/shared';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useGallery(
  eventId: string,
  opts: { featured?: boolean; sort?: GallerySort; guestId?: string; enabled?: boolean } = {},
) {
  const featured = opts.featured ?? false;
  const sort = opts.sort ?? 'latest';
  const guestId = opts.guestId ?? null;
  return useInfiniteQuery({
    queryKey: queryKeys.gallery(eventId, featured, sort, guestId),
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ limit: featured ? '20' : '30', sort });
      if (featured) qs.set('featured', 'true');
      if (guestId) qs.set('guestId', guestId);
      if (pageParam) qs.set('cursor', pageParam);
      return api<Page<GalleryPhoto>>(`/photos?${qs}`, { signal });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: opts.enabled ?? true,
    // Signed URLs last at least an hour; refresh well before that.
    staleTime: 20 * 60_000,
  });
}
