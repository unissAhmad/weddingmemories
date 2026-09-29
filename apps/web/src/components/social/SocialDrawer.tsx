import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Heart, Loader2, SendHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  COMMENT_MAX_LENGTH,
  CommentCreateSchema,
  type CommentCreate,
  type GalleryPhoto,
  type PhotoCommentItem,
  type PhotoLiker,
} from '@wm/shared';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import { markRankingsStale, patchGalleryPhoto } from './cache';
import type { SocialPanel } from './PhotoActionBar';

interface SocialDrawerProps {
  photo: GalleryPhoto | null;
  panel: SocialPanel;
  eventId: string;
  onClose: () => void;
}

/** One bottom sheet for the whole gallery, showing likes or comments for the chosen photo. */
export function SocialDrawer({ photo, panel, eventId, onClose }: SocialDrawerProps) {
  return (
    <Drawer open={photo !== null} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent aria-describedby={undefined}>
        {photo && (panel === 'likes' ? <Likes photo={photo} /> : <Comments photo={photo} eventId={eventId} />)}
      </DrawerContent>
    </Drawer>
  );
}

function PhotoPeek({ photo }: { photo: GalleryPhoto }) {
  return (
    <img
      src={photo.thumbUrl}
      alt=""
      className="size-11 shrink-0 rounded-md object-cover"
      width={44}
      height={44}
    />
  );
}

/** Soft, stable colour per name for the initials avatar. */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ background: `hsl(${hue} 32% 52%)` }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}

function Likes({ photo }: { photo: GalleryPhoto }) {
  const likes = useQuery({
    queryKey: ['photos', 'likes', photo.id],
    queryFn: ({ signal }) => api<PhotoLiker[]>(`/photos/${photo.id}/likes`, { signal }),
  });

  return (
    <>
      <DrawerHeader className="flex items-center gap-3 text-left">
        <PhotoPeek photo={photo} />
        <div className="min-w-0">
          <DrawerTitle>Liked by</DrawerTitle>
          <DrawerDescription>
            {photo.likeCount} {photo.likeCount === 1 ? 'person' : 'people'} · photo by {photo.guestName}
          </DrawerDescription>
        </div>
      </DrawerHeader>
      <div className="safe-bottom overflow-y-auto px-5 pb-4">
        {likes.isPending && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
        {likes.data?.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No likes yet.</p>}
        <ul className="divide-y">
          {likes.data?.map((l) => (
            <li key={l.guestId} className="flex items-center gap-3 py-3">
              <Avatar name={l.guestName} />
              <span className="flex-1 truncate font-medium">
                {l.guestName}
                {l.isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
              </span>
              <span className="text-xs text-muted-foreground">{timeAgo(l.createdAt)}</span>
              <Heart className="size-4 fill-red-500 text-red-500" />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Comments({ photo, eventId }: { photo: GalleryPhoto; eventId: string }) {
  const qc = useQueryClient();
  const key = ['photos', 'comments', photo.id];
  const listEnd = useRef<HTMLDivElement>(null);

  const comments = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api<PhotoCommentItem[]>(`/photos/${photo.id}/comments`, { signal }),
  });

  // Keep the newest comment in view.
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' });
  }, [comments.data?.length]);

  const form = useForm<CommentCreate>({ resolver: zodResolver(CommentCreateSchema), defaultValues: { body: '' } });
  const body = form.watch('body');

  const add = useMutation({
    mutationFn: (d: CommentCreate) =>
      api<PhotoCommentItem>(`/photos/${photo.id}/comments`, { method: 'POST', body: d }),
    onSuccess: (comment) => {
      qc.setQueryData<PhotoCommentItem[]>(key, (list) => [...(list ?? []), comment]);
      patchGalleryPhoto(qc, eventId, photo.id, (p) => ({ commentCount: p.commentCount + 1 }));
      markRankingsStale(qc, eventId);
      form.reset({ body: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/photos/${photo.id}/comments/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      qc.setQueryData<PhotoCommentItem[]>(key, (list) => list?.filter((c) => c.id !== id));
      patchGalleryPhoto(qc, eventId, photo.id, (p) => ({ commentCount: Math.max(0, p.commentCount - 1) }));
      markRankingsStale(qc, eventId);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <DrawerHeader className="flex items-center gap-3 text-left">
        <PhotoPeek photo={photo} />
        <div className="min-w-0">
          <DrawerTitle>Comments</DrawerTitle>
          <DrawerDescription>Photo by {photo.guestName}</DrawerDescription>
        </div>
      </DrawerHeader>

      <div className="min-h-32 flex-1 overflow-y-auto px-5">
        {comments.isPending && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
        {comments.data?.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No comments yet. Be the first!</p>
        )}
        <ul className="grid gap-4 py-2">
          {comments.data?.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.guestName} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{c.guestName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="mt-0.5 text-sm break-words whitespace-pre-line">{c.body}</p>
              </div>
              {c.mine && (
                <button
                  type="button"
                  onClick={() => remove.mutate(c.id)}
                  disabled={remove.isPending}
                  aria-label="Delete your comment"
                  className="self-start rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div ref={listEnd} />
      </div>

      <DrawerFooter>
        <form className="flex items-end gap-2" noValidate onSubmit={form.handleSubmit((d) => add.mutate(d))}>
          <Textarea
            aria-label="Write a comment"
            placeholder="Write something kind…"
            rows={1}
            maxLength={COMMENT_MAX_LENGTH}
            className="max-h-32 min-h-11 resize-none py-2.5"
            {...form.register('body')}
            onKeyDown={(e) => {
              // Enter sends on a keyboard; Shift+Enter makes a new line.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void form.handleSubmit((d) => add.mutate(d))();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className={cn('size-11 shrink-0', !body.trim() && 'opacity-60')}
            disabled={add.isPending || !body.trim()}
            aria-label="Post comment"
          >
            {add.isPending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          </Button>
        </form>
        {form.formState.errors.body && (
          <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
        )}
      </DrawerFooter>
    </>
  );
}
