import { useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { Camera, Loader2, Sparkles } from 'lucide-react';
import type { GalleryPhoto } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BlurImage } from '@/components/gallery/BlurImage';
import { Masonry } from '@/components/gallery/Masonry';
import { useLightbox, type LightboxItem } from '@/components/gallery/useLightbox';
import { useGallery } from '@/hooks/useGallery';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useMe } from '@/hooks/useMe';
import { isApiError } from '@/lib/api';
import { useGuestContext } from './GuestShell';
import { AccessGate } from './AccessGate';

const toLightbox = (p: GalleryPhoto): LightboxItem => ({
  src: p.displayUrl,
  msrc: p.thumbUrl,
  width: p.width,
  height: p.height,
  alt: `Photo by ${p.guestName}`,
  caption: `by ${p.guestName}`,
});

export function GalleryPage() {
  const { me } = useGuestContext();
  // Poll while waiting so the gallery opens as soon as the couple approves.
  useMe({ refetchInterval: me.access === 'PENDING' ? 30_000 : false });

  if (me.access !== 'APPROVED') return <AccessGate status={me.access} />;
  return <Gallery />;
}

function Gallery() {
  const { event } = useGuestContext();
  const all = useGallery(event.id);
  const featured = useGallery(event.id, { featured: true });

  const photos = useMemo(() => all.data?.pages.flatMap((p) => p.items) ?? [], [all.data]);
  const highlights = useMemo(() => featured.data?.pages.flatMap((p) => p.items) ?? [], [featured.data]);

  const loadMore = useCallback(() => {
    if (all.hasNextPage && !all.isFetchingNextPage) void all.fetchNextPage();
  }, [all]);

  const openAll = useLightbox(useMemo(() => photos.map(toLightbox), [photos]), { onNearEnd: loadMore });
  const openHighlight = useLightbox(useMemo(() => highlights.map(toLightbox), [highlights]));
  const sentinel = useInfiniteScroll(loadMore, Boolean(all.hasNextPage) && !all.isFetchingNextPage);
  const ratio = useCallback((p: GalleryPhoto) => p.height / p.width, []);

  if (all.isError) {
    const revoked = isApiError(all.error, 'ACCESS_REQUIRED');
    return (
      <main className="mx-auto max-w-md px-5 pt-16 text-center">
        <p className="text-muted-foreground">
          {revoked ? 'Your access to the gallery has changed.' : "We couldn't load the gallery."}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => void all.refetch()}>
          Try again
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-3 pt-8 sm:px-5">
      <div className="mb-8 px-2 text-center">
        <p className="eyebrow">The gallery</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Every moment, together</h1>
      </div>

      {highlights.length > 0 && (
        <section className="mb-10" aria-labelledby="highlights">
          <h2 id="highlights" className="mb-3 flex items-center gap-2 px-2 text-xl">
            <Sparkles className="size-4 text-accent" /> Highlights
          </h2>
          <ul className="-mx-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            {highlights.map((p, i) => (
              <li key={p.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  onClick={() => openHighlight(i)}
                  className="block overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Open highlight by ${p.guestName}`}
                >
                  <BlurImage
                    src={p.thumbUrl}
                    blurhash={p.blurhash}
                    width={p.width}
                    height={p.height}
                    alt=""
                    className="h-52 sm:h-64"
                    style={{ aspectRatio: `${p.width} / ${p.height}` }}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {all.isPending ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[1.3, 0.75, 1, 1.4, 0.8, 1.1].map((r, i) => (
            <Skeleton key={i} style={{ aspectRatio: `1 / ${r}` }} />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="mx-auto max-w-sm rounded-xl border border-dashed p-8 text-center">
          <p className="font-serif text-xl">No photos yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Be the first to share a moment.</p>
          <Button asChild className="mt-5">
            <Link to={`/e/${event.slug}/upload`}>
              <Camera /> Share photos
            </Link>
          </Button>
        </div>
      ) : (
        <Masonry
          items={photos}
          getRatio={ratio}
          getKey={(p) => p.id}
          render={(p, i) => (
            <button
              type="button"
              onClick={() => openAll(i)}
              className="group animate-rise-in block w-full overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Open photo by ${p.guestName}`}
            >
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
          )}
        />
      )}

      <div ref={sentinel} aria-hidden />
      {all.isFetchingNextPage && <Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />}
      {!all.hasNextPage && photos.length > 12 && (
        <p className="my-10 text-center font-serif text-lg text-muted-foreground italic">
          That's every photo so far.
        </p>
      )}
    </main>
  );
}
