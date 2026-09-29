import { useCallback, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PhotoFeed, toLightbox } from '@/components/gallery/PhotoFeed';
import { useLightbox } from '@/components/gallery/useLightbox';
import { Avatar } from '@/components/social/Avatar';
import { useFriend } from '@/hooks/useFriends';
import { useGallery } from '@/hooks/useGallery';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { isApiError } from '@/lib/api';
import { useGuestContext } from './GuestShell';
import { AccessGate } from './AccessGate';

export function FriendPhotosPage() {
  const { me } = useGuestContext();
  if (me.access !== 'APPROVED') return <AccessGate status={me.access} />;
  return <FriendPhotos />;
}

function FriendPhotos() {
  const { event } = useGuestContext();
  const { guestId = '' } = useParams();
  const friend = useFriend(event.id, guestId);
  const navigate = useNavigate();
  const fromList = (useLocation().state as { fromFriends?: boolean } | null)?.fromFriends === true;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [guestId]);
  const all = useGallery(event.id, { guestId });
  const photos = useMemo(() => all.data?.pages.flatMap((p) => p.items) ?? [], [all.data]);

  const loadMore = useCallback(() => {
    if (all.hasNextPage && !all.isFetchingNextPage) void all.fetchNextPage();
  }, [all]);
  const open = useLightbox(useMemo(() => photos.map(toLightbox), [photos]), { onNearEnd: loadMore });
  const sentinel = useInfiniteScroll(loadMore, Boolean(all.hasNextPage) && !all.isFetchingNextPage);

  const missing = isApiError(friend.error) && friend.error.status === 404;
  const name = friend.data?.guestName;

  return (
    <main className="mx-auto max-w-5xl px-3 pt-4 sm:px-5">
      {/* Back link, pinned under the header */}
      <div className="sticky top-14 z-20 -mx-3 bg-background/85 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full">
          <Link
            to=".."
            relative="path"
            onClick={(e) => {
              // Came from the Friends list: go back, so it opens where they left it.
              if (fromList) {
                e.preventDefault();
                void navigate(-1);
              }
            }}
          >
            <ArrowLeft /> Back to friends
          </Link>
        </Button>
      </div>

      {missing ? (
        <p className="pt-12 text-center text-muted-foreground">This guest's photos aren't available.</p>
      ) : (
        <>
          <div className="mt-4 mb-8 flex flex-col items-center gap-3 text-center">
            {name ? <Avatar name={name} className="size-16 text-lg" /> : <Skeleton className="size-16 rounded-full" />}
            <div>
              {name ? (
                <h1 className="text-3xl sm:text-4xl">
                  {name}
                  {friend.data?.isMe && <span className="ml-2 font-sans text-sm text-muted-foreground">(you)</span>}
                </h1>
              ) : (
                <Skeleton className="mx-auto h-9 w-48" />
              )}
              {friend.data && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {friend.data.photoCount} {friend.data.photoCount === 1 ? 'photo' : 'photos'} shared
                </p>
              )}
            </div>
          </div>

          {all.isError ? (
            <div className="text-center">
              <p className="text-muted-foreground">We couldn't load these photos.</p>
              <Button className="mt-4" variant="outline" onClick={() => void all.refetch()}>
                Try again
              </Button>
            </div>
          ) : all.isPending ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[1.3, 0.75, 1, 1.4].map((r, i) => (
                <Skeleton key={i} style={{ aspectRatio: `1 / ${r}` }} />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <p className="text-center text-muted-foreground">No photos yet.</p>
          ) : (
            <PhotoFeed photos={photos} eventId={event.id} onOpen={open} />
          )}
        </>
      )}

      <div ref={sentinel} aria-hidden />
      {all.isFetchingNextPage && <Loader2 className="mx-auto my-6 size-5 animate-spin text-muted-foreground" />}
    </main>
  );
}
