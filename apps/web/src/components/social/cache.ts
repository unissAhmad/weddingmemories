import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { GalleryPhoto, Page } from '@wm/shared';
import { queryKeys } from '@/lib/queryKeys';

type GalleryData = InfiniteData<Page<GalleryPhoto>, string | null>;

/** Patches one photo in every cached gallery list (latest, most liked, trending, highlights). */
export function patchGalleryPhoto(
  qc: QueryClient,
  eventId: string,
  photoId: string,
  patch: (p: GalleryPhoto) => Partial<GalleryPhoto>,
) {
  qc.setQueriesData<GalleryData>({ queryKey: queryKeys.galleryAll(eventId) }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((p) => (p.id === photoId ? { ...p, ...patch(p) } : p)),
          })),
        }
      : data,
  );
}

/**
 * Rankings changed: mark the ranked tabs stale so they re-sort next time they're opened,
 * without reshuffling the list the guest is looking at right now.
 */
export function markRankingsStale(qc: QueryClient, eventId: string) {
  for (const sort of ['liked', 'trending'] as const) {
    void qc.invalidateQueries({ queryKey: queryKeys.gallery(eventId, false, sort), refetchType: 'none' });
  }
}
