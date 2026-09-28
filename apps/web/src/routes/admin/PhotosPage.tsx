import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, Download, Eye, EyeOff, Loader2, Maximize2, Star, StarOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminPhoto, Page, PhotoAction } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Badge } from '@/components/ui/badge';
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
import { BlurImage } from '@/components/gallery/BlurImage';
import { useLightbox } from '@/components/gallery/useLightbox';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useAdminEventContext } from './hooks';
import { PageHeader } from './PageHeader';
import { useSelection } from './useSelection';

const STATUS_OPTIONS = [
  { value: '', label: 'All photos' },
  { value: 'READY', label: 'Published' },
  { value: 'HIDDEN', label: 'Hidden / in review' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'FAILED', label: 'Failed' },
];

export function PhotosPage() {
  const { event, base, isOwner } = useAdminEventContext();
  const [params, setParams] = useSearchParams();
  const filters = {
    status: params.get('status') ?? '',
    guestId: params.get('guestId') ?? '',
    featured: params.get('featured') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  };
  const setFilter = (key: keyof typeof filters, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    selection.clear();
  };

  const selection = useSelection();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const list = useInfiniteQuery({
    queryKey: queryKeys.admin.photos(event.id, filters),
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ limit: '60' });
      for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
      if (pageParam) qs.set('cursor', pageParam);
      return api<Page<AdminPhoto>>(`${base}/photos?${qs}`, { signal });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (p) => p.nextCursor,
  });
  const photos = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  const loadMore = useCallback(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
  }, [list]);
  const sentinel = useInfiniteScroll(loadMore, Boolean(list.hasNextPage) && !list.isFetchingNextPage);

  const viewable = useMemo(() => photos.filter((p) => p.displayUrl), [photos]);
  const openLightbox = useLightbox(
    useMemo(
      () =>
        viewable.map((p) => ({
          src: p.displayUrl!,
          msrc: p.thumbUrl ?? undefined,
          width: p.width ?? 1600,
          height: p.height ?? 1200,
          caption: `${p.guestName}${p.status === 'HIDDEN' ? ' · hidden' : ''}`,
        })),
      [viewable],
    ),
    { onNearEnd: loadMore },
  );

  const action = useMutation({
    mutationFn: (body: PhotoAction) => api<{ updated: number }>(`${base}/photos/actions`, { method: 'POST', body }),
    onSuccess: (res, vars) => {
      toast.success(`${res.updated} photo${res.updated === 1 ? '' : 's'} ${PAST[vars.action]}`);
      selection.clear();
      void qc.invalidateQueries({ queryKey: ['admin', 'event', event.id] });
    },
    onError: (err) => toast.error(err.message),
  });

  const download = useMutation({
    mutationFn: (photoIds: string[]) =>
      api(`${base}/downloads`, { method: 'POST', body: { scope: { type: 'selection', photoIds } } }),
    onSuccess: () => {
      toast.success('Preparing your ZIP. It will appear under Downloads and be emailed to you.');
      void qc.invalidateQueries({ queryKey: queryKeys.admin.downloads(event.id) });
    },
    onError: (err) => toast.error(err.message),
  });

  const run = (a: PhotoAction['action']) => action.mutate({ ids: selection.ids, action: a });

  return (
    <>
      <PageHeader title="Photos" description="Hide, feature or remove photos. Tap to select; use the corner button to view." />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <NativeSelect aria-label="Status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Featured" value={filters.featured} onChange={(e) => setFilter('featured', e.target.value)}>
          <option value="">Featured or not</option>
          <option value="true">Featured only</option>
        </NativeSelect>
        <Input type="date" aria-label="From date" className="h-10 text-sm" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        <Input type="date" aria-label="To date" className="h-10 text-sm" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        {filters.guestId ? (
          <Button variant="outline" className="h-10" onClick={() => setFilter('guestId', '')}>
            Showing one guest · clear
          </Button>
        ) : (
          <span className="hidden lg:block" />
        )}
      </div>

      <div
        className={cn(
          'sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b bg-muted/80 px-4 py-2 backdrop-blur transition-opacity sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10',
          selection.count === 0 && 'pointer-events-none h-0 overflow-hidden border-0 py-0 opacity-0',
        )}
      >
        <span className="mr-2 text-sm font-medium">{selection.count} selected</span>
        <Button size="sm" variant="outline" onClick={() => run('hide')} disabled={action.isPending}>
          <EyeOff /> Hide
        </Button>
        <Button size="sm" variant="outline" onClick={() => run('unhide')} disabled={action.isPending}>
          <Eye /> Publish
        </Button>
        <Button size="sm" variant="outline" onClick={() => run('feature')} disabled={action.isPending}>
          <Star /> Feature
        </Button>
        <Button size="sm" variant="outline" onClick={() => run('unfeature')} disabled={action.isPending}>
          <StarOff /> Unfeature
        </Button>
        {isOwner && (
          <Button size="sm" variant="outline" onClick={() => download.mutate(selection.ids)} disabled={download.isPending}>
            <Download /> ZIP
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={action.isPending}>
          <Trash2 /> Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={selection.clear}>
          Clear
        </Button>
      </div>

      {photos.length > 0 && (
        <label className="mb-3 flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={selection.count > 0 && selection.count >= photos.length}
            onCheckedChange={(v) => selection.setAll(photos.map((p) => p.id), v === true)}
          />
          Select all loaded ({photos.length})
        </label>
      )}

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {photos.map((p) => {
          const selected = selection.selected.has(p.id);
          const viewIndex = viewable.findIndex((v) => v.id === p.id);
          return (
            <li key={p.id} className="group relative">
              <button
                type="button"
                onClick={() => selection.toggle(p.id)}
                aria-pressed={selected}
                aria-label={`Select photo by ${p.guestName}`}
                className={cn(
                  'relative block aspect-square w-full overflow-hidden rounded-md ring-offset-2 ring-offset-background transition-shadow focus-visible:outline-none',
                  selected ? 'ring-2 ring-primary' : 'focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <BlurImage
                  src={p.thumbUrl}
                  blurhash={p.blurhash}
                  width={p.width ?? 400}
                  height={p.height ?? 400}
                  alt=""
                  className={cn('size-full', p.status === 'HIDDEN' && 'opacity-50')}
                />
                {p.status === 'PROCESSING' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-muted/70">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </span>
                )}
                {p.status === 'FAILED' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-muted/80 text-destructive">
                    <CircleAlert className="size-5" />
                  </span>
                )}
              </button>
              <span className="pointer-events-none absolute top-1.5 left-1.5">
                <Checkbox checked={selected} tabIndex={-1} aria-hidden className="bg-card/90" />
              </span>
              <span className="pointer-events-none absolute top-1.5 right-1.5 flex gap-1">
                {p.featured && (
                  <Badge variant="accent" className="bg-card/90 px-1.5">
                    <Star className="size-3 fill-current" />
                  </Badge>
                )}
                {p.status === 'HIDDEN' && <Badge className="bg-card/90 px-1.5">Hidden</Badge>}
              </span>
              {viewIndex >= 0 && (
                <button
                  type="button"
                  onClick={() => openLightbox(viewIndex)}
                  aria-label="View larger"
                  className="absolute right-1.5 bottom-1.5 rounded-full bg-card/90 p-1.5 opacity-100 shadow-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Maximize2 className="size-3.5" />
                </button>
              )}
              <p className="mt-1 truncate text-xs text-muted-foreground">
                <button type="button" className="hover:underline" onClick={() => setFilter('guestId', p.guestId)}>
                  {p.guestName}
                </button>
              </p>
            </li>
          );
        })}
      </ul>

      <div ref={sentinel} aria-hidden />
      {(list.isPending || list.isFetchingNextPage) && (
        <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />
      )}
      {!list.isPending && photos.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No photos match these filters.
        </p>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selection.count} photos?</AlertDialogTitle>
            <AlertDialogDescription>
              They disappear from the gallery and downloads immediately, and are permanently removed after 7 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction destructive onClick={() => run('delete')}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const PAST: Record<PhotoAction['action'], string> = {
  hide: 'hidden',
  unhide: 'published',
  feature: 'featured',
  unfeature: 'unfeatured',
  delete: 'deleted',
};
