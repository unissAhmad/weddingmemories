import { useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { Camera, ChevronRight, Loader2 } from 'lucide-react';
import type { FriendWithPreview } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BlurImage } from '@/components/gallery/BlurImage';
import { toLightbox } from '@/components/gallery/PhotoFeed';
import { useLightbox } from '@/components/gallery/useLightbox';
import { Avatar } from '@/components/social/Avatar';
import { useFriends } from '@/hooks/useFriends';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useMe } from '@/hooks/useMe';
import { isApiError } from '@/lib/api';
import { useGuestContext } from './GuestShell';
import { AccessGate } from './AccessGate';

export function FriendsPage() {
  const { me } = useGuestContext();
  // Poll while waiting so the page opens as soon as the couple approves.
  useMe({ refetchInterval: me.access === 'PENDING' ? 30_000 : false });

  if (me.access !== 'APPROVED') return <AccessGate status={me.access} />;
  return <Friends />;
}

function Friends() {
  const { event } = useGuestContext();
  const friends = useFriends(event.id);
  const list = useMemo(() => friends.data?.pages.flatMap((p) => p.items) ?? [], [friends.data]);

  const loadMore = useCallback(() => {
    if (friends.hasNextPage && !friends.isFetchingNextPage) void friends.fetchNextPage();
  }, [friends]);
  const sentinel = useInfiniteScroll(loadMore, Boolean(friends.hasNextPage) && !friends.isFetchingNextPage);

  if (friends.isError) {
    const revoked = isApiError(friends.error, 'ACCESS_REQUIRED');
    return (
      <main className="mx-auto max-w-md px-5 pt-16 text-center">
        <p className="text-muted-foreground">
          {revoked ? 'Your access to the gallery has changed.' : "We couldn't load your friends' photos."}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => void friends.refetch()}>
          Try again
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl pt-8">
      <div className="mb-8 px-5 text-center">
        <p className="eyebrow">Friends</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">Through their eyes</h1>
        <p className="mt-2 text-sm text-muted-foreground">Everyone who has shared, and the moments they caught.</p>
      </div>

      {friends.isPending ? (
        <div className="space-y-8 px-5">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="mb-3 h-6 w-40" />
              <div className="flex gap-2 overflow-hidden">
                {[0.8, 1.2, 0.75, 1].map((r, j) => (
                  <Skeleton key={j} className="h-44 shrink-0 sm:h-52" style={{ aspectRatio: `${r}` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="mx-5 rounded-xl border border-dashed p-8 text-center sm:mx-auto sm:max-w-sm">
          <p className="font-serif text-xl">No one has shared yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Be the first to share a moment.</p>
          <Button asChild className="mt-5">
            <Link to={`/e/${event.slug}/upload`}>
              <Camera /> Share photos
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-9">
          {list.map((f) => (
            <FriendRow key={f.guestId} friend={f} />
          ))}
        </ul>
      )}

      <div ref={sentinel} aria-hidden />
      {friends.isFetchingNextPage && <Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />}
    </main>
  );
}

const FROM_LIST = { fromFriends: true };

/**
 * Explicit width from the photo's shape. Without it, some mobile browsers size the slide to the
 * image's full pixel width and leave a gap beside it.
 */
const slideSize = (p: { width: number; height: number }): React.CSSProperties => ({
  height: 'var(--slide-h)',
  width: `min(calc(var(--slide-h) * ${(p.width / p.height).toFixed(4)}), 75vw)`,
});

function FriendRow({ friend }: { friend: FriendWithPreview }) {
  const open = useLightbox(useMemo(() => friend.preview.map(toLightbox), [friend.preview]));
  const more = friend.photoCount - friend.preview.length;
  const viewAll = friend.guestId;

  return (
    <li className="animate-rise-in min-w-0">
      <div className="mb-3 flex items-center gap-3 px-5">
        <Avatar name={friend.guestName} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-serif text-xl leading-tight">
            {friend.guestName}
            {friend.isMe && <span className="ml-1.5 font-sans text-xs text-muted-foreground">(you)</span>}
          </h2>
          <p className="text-xs text-muted-foreground">
            {friend.photoCount} {friend.photoCount === 1 ? 'photo' : 'photos'}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full">
          <Link to={viewAll} state={FROM_LIST} aria-label={`View all photos by ${friend.guestName}`}>
            View all <ChevronRight />
          </Link>
        </Button>
      </div>

      <ul className="flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {friend.preview.map((p, i) => (
          <li key={p.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => open(i)}
              className="block overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`Open photo ${i + 1} by ${friend.guestName}`}
            >
              <BlurImage
                src={p.thumbUrl}
                blurhash={p.blurhash}
                width={p.width}
                height={p.height}
                alt=""
                className="[--slide-h:11rem] sm:[--slide-h:13rem]"
                style={slideSize(p)}
              />
            </button>
          </li>
        ))}
        {more > 0 && (
          <li className="shrink-0 snap-start">
            <Link
              to={viewAll}
              state={FROM_LIST}
              className="flex h-44 w-28 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-sm text-muted-foreground transition-colors hover:bg-muted sm:h-52"
            >
              <span className="font-serif text-2xl text-foreground">+{more}</span>
              more
            </Link>
          </li>
        )}
      </ul>
    </li>
  );
}
