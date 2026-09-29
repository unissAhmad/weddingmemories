import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, ExternalLink, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  MAX_SHOWCASE_PHOTOS,
  type AdminEventDetail,
  type ShowcaseItem,
  type ShowcaseUploadResponse,
  type Theme,
  type UpdateEvent,
} from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { queryKeys } from '@/lib/queryKeys';
import { resizeImage } from '@/lib/resizeImage';
import { cn } from '@/lib/utils';
import { useAdminEventContext } from './hooks';
import { PageHeader } from './PageHeader';

const THEME_OPTIONS: { id: Theme; name: string; note: string; swatches: string[] }[] = [
  { id: 'ivory', name: 'Ivory & Gold', note: 'Warm, classic, timeless', swatches: ['#faf7f2', '#a88a5e', '#3d352e'] },
  { id: 'blush', name: 'Blush Rose', note: 'Soft, romantic, floral', swatches: ['#fbf5f3', '#c0848b', '#6f3f48'] },
  { id: 'sage', name: 'Sage Garden', note: 'Fresh, natural, garden party', swatches: ['#f5f6f0', '#869866', '#3c5040'] },
  { id: 'midnight', name: 'Midnight', note: 'Dark, glamorous, evening', swatches: ['#11141f', '#d8b67b', '#f0e9dd'] },
];

function useSaveEvent() {
  const { event, base } = useAdminEventContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEvent) => api<AdminEventDetail>(base, { method: 'PATCH', body }),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.admin.event(event.id), updated);
      void qc.invalidateQueries({ queryKey: ['event'] });
    },
    onError: (err) => toast.error(err.message),
  });
}

export function WelcomeSettingsPage() {
  const { event } = useAdminEventContext();
  return (
    <>
      <PageHeader
        title="Welcome page"
        description="The first thing guests see. Add your photos, a personal message, and choose a theme."
        actions={
          <Button asChild variant="outline">
            <a href={event.guestUrl} target="_blank" rel="noreferrer">
              <ExternalLink /> View as a guest
            </a>
          </Button>
        }
      />
      <div className="grid gap-6">
        <PhotosCard />
        <div className="grid gap-6 lg:grid-cols-2">
          <MessageCard />
          <ThemeCard />
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Theme */

function ThemeCard() {
  const { event } = useAdminEventContext();
  const save = useSaveEvent();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
        <CardDescription>Colours for every guest page: welcome, sign-in, uploads and gallery.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {THEME_OPTIONS.map((t) => {
          const selected = event.settings.theme === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={save.isPending}
              aria-pressed={selected}
              onClick={() =>
                !selected && save.mutate({ theme: t.id }, { onSuccess: () => toast.success(`Theme: ${t.name}`) })
              }
              className={cn(
                'relative rounded-xl border p-4 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                selected && 'border-primary ring-1 ring-primary',
              )}
            >
              <div
                className="mb-3 flex h-16 items-end gap-1.5 overflow-hidden rounded-lg p-2.5"
                style={{ background: t.swatches[0] }}
              >
                <span className="font-serif text-lg leading-none" style={{ color: t.swatches[2] }}>
                  A &amp; O
                </span>
                <span className="ml-auto size-5 rounded-full" style={{ background: t.swatches[1] }} />
              </div>
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.note}</p>
              {selected && (
                <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------- Message */

const MessageSchema = z.object({
  greeting: z.string().trim().max(120),
  venue: z.string().trim().max(200),
  welcomeMessage: z.string().trim().max(2000),
});
type MessageForm = z.infer<typeof MessageSchema>;

function MessageCard() {
  const { event } = useAdminEventContext();
  const save = useSaveEvent();
  const form = useForm<MessageForm>({
    resolver: zodResolver(MessageSchema),
    values: {
      greeting: event.greeting ?? '',
      venue: event.venue ?? '',
      welcomeMessage: event.welcomeMessage ?? '',
    },
  });
  const { errors, isDirty } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Greeting &amp; message</CardTitle>
        <CardDescription>Leave a field empty to use the default wording.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit((d) =>
            save.mutate(
              { greeting: d.greeting || null, venue: d.venue || null, welcomeMessage: d.welcomeMessage || null },
              { onSuccess: () => toast.success('Welcome message saved') },
            ),
          )}
        >
          <FormField id="greeting" label="Greeting above your names" error={errors.greeting?.message}>
            <Input id="greeting" className="h-10 text-sm" placeholder="Welcome to the wedding of" {...form.register('greeting')} />
          </FormField>
          <FormField id="venue" label="Venue" hint="e.g. The Lalit Grand Palace, Srinagar" error={errors.venue?.message}>
            <Input id="venue" className="h-10 text-sm" {...form.register('venue')} />
          </FormField>
          <FormField
            id="welcomeMessage"
            label="A note to your guests"
            hint="Shown under 'Dear family & friends', signed with your names."
            error={errors.welcomeMessage?.message}
          >
            <Textarea
              id="welcomeMessage"
              rows={6}
              placeholder="Thank you for being here and for being part of our story…"
              {...form.register('welcomeMessage')}
            />
          </FormField>
          <Button type="submit" className="justify-self-start" disabled={!isDirty || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- Photos */

function PhotosCard() {
  const { event, base } = useAdminEventContext();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [deleting, setDeleting] = useState<ShowcaseItem | null>(null);
  const photos = event.showcase;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.admin.event(event.id) });
    void qc.invalidateQueries({ queryKey: ['event'] });
  };

  const upload = async (files: File[]) => {
    const room = MAX_SHOWCASE_PHOTOS - photos.length;
    const batch = files.slice(0, room);
    if (files.length > room) toast.message(`Only ${room} more photo(s) fit; the rest were skipped.`);
    setUploading({ done: 0, total: batch.length });
    let failed = 0;
    for (const [i, file] of batch.entries()) {
      try {
        const blob = await resizeImage(file);
        const signed = await api<ShowcaseUploadResponse>(`${base}/showcase/upload`, {
          method: 'POST',
          body: { mimeType: blob.type || file.type || 'image/jpeg', size: blob.size },
        });
        const form = new FormData();
        for (const [k, v] of Object.entries(signed.params)) form.append(k, v);
        form.append('file', blob, file.name);
        const res = await fetch(signed.uploadUrl, { method: 'POST', body: form });
        const result = await res.json();
        if (!res.ok) throw new Error(result?.error?.message ?? 'Upload failed');
        await api(`${base}/showcase`, { method: 'POST', body: result });
      } catch (err) {
        failed++;
        toast.error(`${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`);
      }
      setUploading({ done: i + 1, total: batch.length });
    }
    setUploading(null);
    refresh();
    if (batch.length - failed > 0) toast.success(`${batch.length - failed} photo(s) added`);
  };

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api(`${base}/showcase/reorder`, { method: 'POST', body: { ids } }),
    onSuccess: refresh,
    onError: (err) => toast.error(err.message),
  });
  const caption = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      api(`${base}/showcase/${id}`, { method: 'PATCH', body: { caption: value || null } }),
    onSuccess: () => {
      toast.success('Caption saved');
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`${base}/showcase/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Photo removed');
      refresh();
    },
    onError: (err) => toast.error(err.message),
  });

  const move = (index: number, by: -1 | 1) => {
    const ids = photos.map((p) => p.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);
    reorder.mutate(ids);
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 space-y-0">
        <div className="grid gap-1.5">
          <CardTitle>Your photos</CardTitle>
          <CardDescription>
            They play as a full-screen slideshow behind your names and appear under “Our moments”. The first photo
            shows first. Up to {MAX_SHOWCASE_PHOTOS}.
          </CardDescription>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) void upload(files);
          }}
        />
        <Button onClick={() => input.current?.click()} disabled={uploading !== null || photos.length >= MAX_SHOWCASE_PHOTOS}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {uploading ? `Uploading ${uploading.done}/${uploading.total}…` : 'Add photos'}
        </Button>
      </CardHeader>
      <CardContent>
        {photos.length === 0 ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground hover:bg-muted/40"
          >
            <ImagePlus className="size-6 text-accent" />
            No photos yet. Add a few of your favourites: engagement shoots, the two of you, family.
          </button>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p, i) => (
              <li key={p.id} className="grid gap-2">
                <div className="relative overflow-hidden rounded-lg bg-muted">
                  <img
                    src={p.thumbUrl}
                    alt={p.caption ?? ''}
                    className="aspect-[4/5] w-full object-cover"
                    style={{ backgroundImage: `url(${p.placeholderUrl})`, backgroundSize: 'cover' }}
                    loading="lazy"
                  />
                  {i === 0 && <Badge className="absolute top-2 left-2 bg-card/90">Shows first</Badge>}
                  <div className="absolute inset-x-2 bottom-2 flex justify-between">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="size-8 bg-card/90"
                      aria-label="Move earlier"
                      disabled={i === 0 || reorder.isPending}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowLeft />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="size-8 bg-card/90 text-destructive"
                      aria-label="Remove photo"
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="size-8 bg-card/90"
                      aria-label="Move later"
                      disabled={i === photos.length - 1 || reorder.isPending}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowRight />
                    </Button>
                  </div>
                </div>
                <Input
                  aria-label="Caption"
                  placeholder="Add a caption…"
                  defaultValue={p.caption ?? ''}
                  maxLength={200}
                  className="h-9 text-sm"
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value !== (p.caption ?? '')) caption.mutate({ id: p.id, value });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this photo?</AlertDialogTitle>
            <AlertDialogDescription>It disappears from the welcome page and is deleted from storage.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => deleting && remove.mutate(deleting.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
