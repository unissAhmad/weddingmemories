import { useInfiniteQuery } from '@tanstack/react-query';
import type { GalleryPhoto, Page } from '@wm/shared';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useGallery(eventId: string, opts: { featured?: boolean; enabled?: boolean } = {}) {
  const featured = opts.featured ?? false;
  return useInfiniteQuery({
    queryKey: queryKeys.gallery(eventId, featured),
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ limit: featured ? '20' : '30' });
      if (featured) qs.set('featured', 'true');
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
