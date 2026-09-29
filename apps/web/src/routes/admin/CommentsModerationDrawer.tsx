import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminComment, AdminPhoto } from '@wm/shared';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { useAdminEventContext } from './hooks';

/** Lets admins read a photo's comments and remove inappropriate ones (recorded in the audit log). */
export function CommentsModerationDrawer({ photo, onClose }: { photo: AdminPhoto | null; onClose: () => void }) {
  const { event, base } = useAdminEventContext();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<AdminComment | null>(null);
  const key = ['admin', 'event', event.id, 'comments', photo?.id];

  const comments = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api<AdminComment[]>(`${base}/photos/${photo!.id}/comments`, { signal }),
    enabled: photo !== null,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`${base}/comments/${id}`, { method: 'DELETE' }),
    onSuccess: (_r, id) => {
      qc.setQueryData<AdminComment[]>(key, (list) => list?.filter((c) => c.id !== id));
      void qc.invalidateQueries({ queryKey: ['admin', 'event', event.id, 'photos'] });
      toast.success('Comment removed');
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <Drawer open={photo !== null} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent>
          {photo && (
            <>
              <DrawerHeader className="flex items-center gap-3 text-left">
                {photo.thumbUrl && <img src={photo.thumbUrl} alt="" className="size-11 rounded-md object-cover" />}
                <div>
                  <DrawerTitle>Comments</DrawerTitle>
                  <DrawerDescription>Photo by {photo.guestName}. Removing a comment can't be undone.</DrawerDescription>
                </div>
              </DrawerHeader>
              <div className="safe-bottom overflow-y-auto px-5 pb-4">
                {comments.isPending && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
                {comments.data?.length === 0 && (
                  <p className="py-10 text-center text-sm text-muted-foreground">No comments on this photo.</p>
                )}
                <ul className="divide-y">
                  {comments.data?.map((c) => (
                    <li key={c.id} className="flex gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-semibold">{c.guestName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                        </p>
                        <p className="mt-0.5 text-sm break-words whitespace-pre-line">{c.body}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirm(c)}
                        aria-label={`Remove comment by ${c.guestName}`}
                        className="self-start rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>

      <AlertDialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              “{confirm?.body.slice(0, 120)}” by {confirm?.guestName} will disappear for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => confirm && remove.mutate(confirm.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
