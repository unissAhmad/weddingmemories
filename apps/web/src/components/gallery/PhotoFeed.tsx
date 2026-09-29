import { useCallback, useState } from 'react';
import type { GalleryPhoto } from '@wm/shared';
import { PhotoActionBar, type SocialPanel } from '@/components/social/PhotoActionBar';
import { SocialDrawer } from '@/components/social/SocialDrawer';
import { BlurImage } from './BlurImage';
import { Masonry } from './Masonry';
import type { LightboxItem } from './useLightbox';

export const toLightbox = (p: GalleryPhoto): LightboxItem => ({
  src: p.displayUrl,
  msrc: p.thumbUrl,
  width: p.width,
  height: p.height,
  alt: `Photo by ${p.guestName}`,
  caption: `by ${p.guestName}`,
});

interface PhotoFeedProps {
  photos: GalleryPhoto[];
  eventId: string;
  onOpen: (index: number) => void;
  /** Drawn over the top-left corner of a photo, e.g. a rank */
  badge?: (index: number) => React.ReactNode;
}

/** Masonry of photos, each with its like/comment bar, and the one likes/comments drawer. */
export function PhotoFeed({ photos, eventId, onOpen, badge }: PhotoFeedProps) {
  const ratio = useCallback((p: GalleryPhoto) => p.height / p.width, []);

  // Which photo's likes/comments drawer is open. The photo is read from the live list, so
  // counts in the drawer header stay in sync with the bar under the photo.
  const [social, setSocial] = useState<{ photoId: string; panel: SocialPanel } | null>(null);
  const socialPhoto = social ? (photos.find((p) => p.id === social.photoId) ?? null) : null;

  return (
    <>
      <Masonry
        items={photos}
        getRatio={ratio}
        getKey={(p) => p.id}
        render={(p, i) => (
          <figure className="animate-rise-in">
            <button
              type="button"
              onClick={() => onOpen(i)}
              className="group relative block w-full overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Open photo by ${p.guestName}`}
            >
              {badge?.(i)}
              <BlurImage
                src={p.thumbUrl}
                blurhash={p.blurhash}
                width={p.width}
                height={p.height}
                alt=""
                className="w-full transition-transform duration-500 group-hover:scale-[1.02]"
                style={{ aspectRatio: `${p.width} / ${p.height}` }}
              />
            </button>
            <PhotoActionBar photo={p} eventId={eventId} onOpen={(panel) => setSocial({ photoId: p.id, panel })} />
          </figure>
        )}
      />
      <SocialDrawer
        photo={socialPhoto}
        panel={social?.panel ?? 'likes'}
        eventId={eventId}
        onClose={() => setSocial(null)}
      />
    </>
  );
}
