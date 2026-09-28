import { CircleAlert, EyeOff, Loader2 } from 'lucide-react';
import type { MyPhoto } from '@wm/shared';
import { useMyPhotos } from '@/hooks/useMyPhotos';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { BlurImage } from './BlurImage';

export function MyPhotoGrid({ eventId }: { eventId: string }) {
  const query = useMyPhotos(eventId);
  const photos = query.data?.pages.flatMap((p) => p.items) ?? [];
  const sentinel = useInfiniteScroll(
    () => void query.fetchNextPage(),
    Boolean(query.hasNextPage) && !query.isFetchingNextPage,
  );

  if (query.isPending) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn't load your photos.{' '}
        <button className="underline" onClick={() => void query.refetch()}>
          Try again
        </button>
      </p>
    );
  }

  if (photos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Photos you share will appear here.
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {photos.map((photo) => (
          <li key={photo.id} className="relative aspect-square overflow-hidden rounded-md">
            <BlurImage
              src={photo.thumbUrl}
              blurhash={photo.blurhash}
              width={photo.width ?? 400}
              height={photo.height ?? 400}
              alt="Your photo"
              className="size-full"
            />
            <StatusOverlay status={photo.status} />
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden />
      {query.isFetchingNextPage && (
        <Loader2 className="mx-auto mt-4 size-5 animate-spin text-muted-foreground" />
      )}
    </>
  );
}

function StatusOverlay({ status }: { status: MyPhoto['status'] }) {
  if (status === 'READY') return null;
  const content = {
    PROCESSING: { icon: <Loader2 className="size-4 animate-spin" />, label: 'Processing' },
    HIDDEN: { icon: <EyeOff className="size-4" />, label: 'In review' },
    FAILED: { icon: <CircleAlert className="size-4" />, label: "Couldn't process" },
  }[status as 'PROCESSING' | 'HIDDEN' | 'FAILED'];
  if (!content) return null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-foreground/35 text-[11px] font-medium text-background backdrop-blur-[1px]">
      {content.icon}
      {content.label}
    </div>
  );
}
