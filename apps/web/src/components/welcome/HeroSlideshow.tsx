import { useEffect, useState } from 'react';
import type { ShowcaseItem } from '@wm/shared';

const SLIDE_MS = 6500;

/**
 * Full-bleed crossfading slideshow with a slow "Ken Burns" zoom. Only the current and previous
 * slides are in the DOM, so a long list of photos doesn't load all at once.
 */
export function HeroSlideshow({ photos }: { photos: ShowcaseItem[] }) {
  const [{ current, previous }, setSlides] = useState({ current: 0, previous: -1 });

  useEffect(() => {
    if (photos.length < 2) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setInterval(
      () => setSlides((s) => ({ current: (s.current + 1) % photos.length, previous: s.current })),
      reduceMotion ? SLIDE_MS * 2 : SLIDE_MS,
    );
    return () => window.clearInterval(timer);
  }, [photos.length]);

  // Warm the cache for the next slide so the crossfade never shows a half-loaded image.
  useEffect(() => {
    const next = photos[(current + 1) % photos.length];
    if (next && photos.length > 1) new Image().src = next.url;
  }, [current, photos]);

  const layers = [previous, current].filter((i) => i >= 0 && i < photos.length);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black" aria-hidden>
      {layers.map((i) => {
        const photo = photos[i]!;
        const isCurrent = i === current;
        return (
          <div
            key={`${photo.id}-${isCurrent ? 'current' : 'previous'}`}
            className={isCurrent && previous >= 0 ? 'absolute inset-0 animate-[fade-in_1.6s_ease-out_both]' : 'absolute inset-0'}
            style={{
              backgroundImage: `url(${photo.placeholderUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <img
              src={photo.url}
              alt=""
              className="size-full animate-ken-burns object-cover"
              fetchPriority={i === 0 ? 'high' : 'auto'}
            />
          </div>
        );
      })}
    </div>
  );
}
