import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { GalleryPhoto, LikeState } from '@wm/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { markRankingsStale, patchGalleryPhoto } from './cache';

export type SocialPanel = 'likes' | 'comments';

interface PhotoActionBarProps {
  photo: GalleryPhoto;
  eventId: string;
  onOpen: (panel: SocialPanel) => void;
}

/** Heart + count, comment + count, and the photographer's name, under each gallery photo. */
export function PhotoActionBar({ photo, eventId, onOpen }: PhotoActionBarProps) {
  const qc = useQueryClient();
  const [pop, setPop] = useState(0);

  const toggle = useMutation({
    mutationFn: (like: boolean) =>
      api<LikeState>(`/photos/${photo.id}/like`, { method: like ? 'POST' : 'DELETE' }),
    // Optimistic: the heart reacts instantly, even on slow venue Wi-Fi.
    onMutate: (like) => {
      const before = { liked: photo.likedByMe, count: photo.likeCount };
      patchGalleryPhoto(qc, eventId, photo.id, (p) => ({
        likedByMe: like,
        likeCount: Math.max(0, p.likeCount + (like ? 1 : -1)),
      }));
      return before;
    },
    onSuccess: (state) =>
      patchGalleryPhoto(qc, eventId, photo.id, () => ({ likedByMe: state.liked, likeCount: state.likeCount })),
    onError: (err, _like, before) => {
      if (before) patchGalleryPhoto(qc, eventId, photo.id, () => ({ likedByMe: before.liked, likeCount: before.count }));
      toast.error(err.message);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['photos', 'likes', photo.id] });
      markRankingsStale(qc, eventId);
    },
  });

  const onHeart = () => {
    const like = !photo.likedByMe;
    if (like) setPop((n) => n + 1);
    toggle.mutate(like);
  };

  return (
    <div className="flex items-center gap-1 px-0.5 pt-1.5 pb-1 text-sm">
      <button
        type="button"
        onClick={onHeart}
        aria-pressed={photo.likedByMe}
        aria-label={photo.likedByMe ? 'Unlike photo' : 'Like photo'}
        className="-m-1 flex size-8 items-center justify-center rounded-full transition-colors hover:bg-muted"
      >
        <Heart
          key={pop}
          className={cn(
            'size-[1.15rem] transition-colors',
            photo.likedByMe ? 'animate-heart-pop fill-red-500 text-red-500' : 'text-foreground/75',
          )}
          strokeWidth={photo.likedByMe ? 2 : 1.75}
        />
      </button>
      <button
        type="button"
        onClick={() => onOpen('likes')}
        disabled={photo.likeCount === 0}
        className="min-w-5 rounded px-0.5 text-left tabular-nums text-foreground/80 hover:underline disabled:no-underline disabled:opacity-60"
        aria-label={`${photo.likeCount} ${photo.likeCount === 1 ? 'like' : 'likes'}, see who`}
      >
        {photo.likeCount}
      </button>

      <button
        type="button"
        onClick={() => onOpen('comments')}
        className="ml-2 flex items-center gap-1.5 rounded-full px-1 py-1 text-foreground/80 transition-colors hover:bg-muted"
        aria-label={`${photo.commentCount} ${photo.commentCount === 1 ? 'comment' : 'comments'}, open comments`}
      >
        <MessageCircle className="size-[1.1rem] text-foreground/75" strokeWidth={1.75} />
        <span className="tabular-nums">{photo.commentCount}</span>
      </button>

      <span className="ml-auto truncate pl-2 font-serif text-[0.95rem] text-muted-foreground italic">
        {photo.guestName}
      </span>
    </div>
  );
}
