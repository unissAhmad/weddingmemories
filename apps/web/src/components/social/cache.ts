import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { GalleryPhoto, Page } from '@wm/shared';
import { queryKeys } from '@/lib/queryKeys';

type GalleryData = InfiniteData<Page<GalleryPhoto>, string | null>;

/** Patches one photo in every cached gallery list (all photos and highlights). */
export function patchGalleryPhoto(
  qc: QueryClient,
  eventId: string,
  photoId: string,
  patch: (p: GalleryPhoto) => Partial<GalleryPhoto>,
) {
  for (const featured of [false, true]) {
    qc.setQueryData<GalleryData>(queryKeys.gallery(eventId, featured), (data) =>
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
}
