import type { GallerySort } from '@wm/shared';

export const queryKeys = {
  event: (slug: string) => ['event', slug] as const,
  homeEvent: ['event', 'home'] as const,
  me: ['guest', 'me'] as const,
  myPhotos: (eventId: string) => ['photos', 'mine', eventId] as const,
  gallery: (eventId: string, featured = false, sort: GallerySort = 'latest') =>
    ['photos', 'gallery', eventId, { featured, sort }] as const,
  galleryAll: (eventId: string) => ['photos', 'gallery', eventId] as const,

  admin: {
    me: ['admin', 'me'] as const,
    events: ['admin', 'events'] as const,
    event: (eventId: string) => ['admin', 'event', eventId] as const,
    stats: (eventId: string) => ['admin', 'event', eventId, 'stats'] as const,
    access: (eventId: string, status: string) => ['admin', 'event', eventId, 'access', status] as const,
    photos: (eventId: string, filters: object) => ['admin', 'event', eventId, 'photos', filters] as const,
    guests: (eventId: string, q: string) => ['admin', 'event', eventId, 'guests', q] as const,
    downloads: (eventId: string) => ['admin', 'event', eventId, 'downloads'] as const,
    audit: (eventId: string) => ['admin', 'event', eventId, 'audit'] as const,
    team: ['admin', 'team'] as const,
  },
};
