import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Link } from 'react-router';
import { Camera, Clock, Flame, Heart, Loader2, Sparkles } from 'lucide-react';
import type { GalleryPhoto, GallerySort } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BlurImage } from '@/components/gallery/BlurImage';
import { Masonry } from '@/components/gallery/Masonry';
import { useLightbox, type LightboxItem } from '@/components/gallery/useLightbox';
import { PhotoActionBar, type SocialPanel } from '@/components/social/PhotoActionBar';
import { SocialDrawer } from '@/components/social/SocialDrawer';
import { useGallery } from '@/hooks/useGallery';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useMe } from '@/hooks/useMe';
import { isApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
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

const TABS: { id: GallerySort; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'latest', label: 'Latest', icon: <Clock />, hint: 'Newest first' },
  { id: 'liked', label: 'Most liked', icon: <Heart />, hint: 'Ranked by likes' },
  { id: 'trending', label: 'Trending', icon: <Flame />, hint: 'Ranked by comments' },
];

const EMPTY: Record<Exclude<GallerySort, 'latest'>, { title: string; body: string }> = {
  liked: { title: 'No likes yet', body: 'Tap the ♥ under a photo you love, and it will show up here.' },
  trending: { title: 'No conversations yet', body: 'Comment on a photo to start one; the most talked-about rise to the top.' },
};

const RANK_STYLES = ['bg-[#d4af37] text-black', 'bg-[#c0c0c0] text-black', 'bg-[#cd7f32] text-white'];

function Gallery() {
  const { event } = useGuestContext();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'latest';
  const ranked = tab !== 'latest';
  const all = useGallery(event.id, { sort: tab });
  const featured = useGallery(event.id, { featured: true, enabled: !ranked });

  // Rankings can shift between pages while people react; never show a photo twice.
  const photos = useMemo(() => {
    const seen = new Set<string>();
    return (all.data?.pages.flatMap((p) => p.items) ?? []).filter((p) => !seen.has(p.id) && seen.add(p.id));
  }, [all.data]);
  const highlights = useMemo(() => featured.data?.pages.flatMap((p) => p.items) ?? [], [featured.data]);

  const loadMore = useCallback(() => {
    if (all.hasNextPage && !all.isFetchingNextPage) void all.fetchNextPage();
  }, [all]);

  const openAll = useLightbox(useMemo(() => photos.map(toLightbox), [photos]), { onNearEnd: loadMore });
  const openHighlight = useLightbox(useMemo(() => highlights.map(toLightbox), [highlights]));
  const sentinel = useInfiniteScroll(loadMore, Boolean(all.hasNextPage) && !all.isFetchingNextPage);
  const ratio = useCallback((p: GalleryPhoto) => p.height / p.width, []);

  // Which photo's likes/comments drawer is open. The photo is read from the live list, so
  // counts in the drawer header stay in sync with the bar under the photo.
  const [social, setSocial] = useState<{ photoId: string; panel: SocialPanel } | null>(null);
  const socialPhoto = social ? (photos.find((p) => p.id === social.photoId) ?? null) : null;

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
      <div className="mb-6 px-2 text-center">
        <p className="eyebrow">The gallery</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Every moment, together</h1>
      </div>

      {/* Tabs, pinned under the header while scrolling */}
      <div className="sticky top-14 z-20 -mx-3 mb-6 bg-background/85 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Sort photos" className="mx-auto grid max-w-md grid-cols-3 gap-1 rounded-full border bg-card p-1 shadow-xs">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => {
                setParams(t.id === 'latest' ? {} : { tab: t.id }, { replace: true });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-medium transition-colors sm:text-sm [&_svg]:size-3.5',
                tab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        {ranked && <p className="mt-2 text-center text-xs text-muted-foreground">{TABS.find((t) => t.id === tab)!.hint}</p>}
      </div>

      {!ranked && highlights.length > 0 && (
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
      ) : photos.length === 0 && ranked ? (
        <div className="mx-auto max-w-sm rounded-xl border border-dashed p-8 text-center">
          <p className="font-serif text-xl">{EMPTY[tab].title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{EMPTY[tab].body}</p>
          <Button variant="outline" className="mt-5" onClick={() => setParams({}, { replace: true })}>
            <Clock /> See the latest photos
          </Button>
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
            <figure className="animate-rise-in">
              <button
                type="button"
                onClick={() => openAll(i)}
                className="group relative block w-full overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Open photo by ${p.guestName}`}
              >
                {ranked && i < 3 && (
                  <span
                    className={cn(
                      'absolute top-2 left-2 z-10 flex size-7 items-center justify-center rounded-full font-sans text-xs font-bold tabular-nums shadow-md ring-2 ring-white/70',
                      RANK_STYLES[i],
                    )}
                    aria-label={`Number ${i + 1}`}
                  >
                    {i + 1}
                  </span>
                )}
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
              <PhotoActionBar photo={p} eventId={event.id} onOpen={(panel) => setSocial({ photoId: p.id, panel })} />
            </figure>
          )}
        />
      )}

      <SocialDrawer
        photo={socialPhoto}
        panel={social?.panel ?? 'likes'}
        eventId={event.id}
        onClose={() => setSocial(null)}
      />

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
