import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  Copy,
  Download,
  Images,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Undo2,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminGuest, CodeGuest, GuestUpdate, Page } from '@wm/shared';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { formatDateTime, useAdminEventContext } from './hooks';
import { PageHeader } from './PageHeader';
import { AddCodeGuestsDialog } from './AddCodeGuestsDialog';

const ACCESS_BADGE = {
  APPROVED: { label: 'Gallery access', variant: 'success' },
  PENDING: { label: 'Waiting', variant: 'warning' },
  REJECTED: { label: 'No access', variant: 'secondary' },
} as const;

export function GuestsPage() {
  const { event, base, isOwner } = useAdminEventContext();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const list = useInfiniteQuery({
    queryKey: queryKeys.admin.guests(event.id, q),
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ limit: '50' });
      if (q) qs.set('q', q);
      if (pageParam) qs.set('cursor', pageParam);
      return api<Page<AdminGuest>>(`${base}/guests?${qs}`, { signal });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (p) => p.nextCursor,
  });
  const guests = list.data?.pages.flatMap((p) => p.items) ?? [];

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: GuestUpdate }) =>
      api(`${base}/guests/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success('Guest updated');
      void qc.invalidateQueries({ queryKey: ['admin', 'event', event.id] });
    },
    onError: (err) => toast.error(err.message),
  });

  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<AdminGuest | null>(null);
  const resetCode = useMutation({
    mutationFn: (id: string) => api<CodeGuest>(`${base}/guests/${id}/code`, { method: 'POST' }),
    onSuccess: (g) => {
      toast.success(`New code for ${g.name}: ${g.code}`, { duration: 10_000 });
      void qc.invalidateQueries({ queryKey: ['admin', 'event', event.id] });
    },
    onError: (err) => toast.error(err.message),
  });

  const download = useMutation({
    mutationFn: (guestId: string) =>
      api(`${base}/downloads`, { method: 'POST', body: { scope: { type: 'guest', guestId } } }),
    onSuccess: () => toast.success('Download ready: open Downloads to save the ZIP.'),
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Guests"
        description="Guests who verified their email, plus guests you invited with a personal access code."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Ticket /> Add guests with codes
          </Button>
        }
      />
      <AddCodeGuestsDialog open={adding} onOpenChange={setAdding} />
      <AlertDialog open={resetting !== null} onOpenChange={(v) => !v && setResetting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>New code for {resetting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their current code stops working immediately. Devices already signed in stay signed in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetting && resetCode.mutate(resetting.id)}>Create new code</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search guests"
          placeholder="Search name or email"
          autoComplete="off"
          className="h-10 pl-9 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guest</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden text-right md:table-cell">Photos</TableHead>
              <TableHead className="hidden lg:table-cell">Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guests.map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  <p className="font-medium">{g.name}</p>
                  {g.contact && <p className="text-xs text-muted-foreground">{g.contact}</p>}
                  {g.accessCode && (
                    <button
                      type="button"
                      title="Copy access code"
                      onClick={() =>
                        void navigator.clipboard.writeText(g.accessCode!).then(() => toast.success('Code copied'))
                      }
                      className="mt-0.5 inline-flex items-center gap-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-xs tracking-wider hover:bg-secondary"
                    >
                      {g.accessCode}
                      <Copy className="size-3 text-muted-foreground" />
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {g.blocked && <Badge variant="destructive">Blocked</Badge>}
                    {g.access && <Badge variant={ACCESS_BADGE[g.access].variant}>{ACCESS_BADGE[g.access].label}</Badge>}
                  </div>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{g.photoCount}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {g.verifiedAt ? formatDateTime(g.verifiedAt) : 'Not joined yet'}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {g.accessCode && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="New access code"
                      aria-label={`New access code for ${g.name}`}
                      onClick={() => setResetting(g)}
                    >
                      <RefreshCw />
                    </Button>
                  )}
                  {g.photoCount > 0 && (
                    <Button asChild size="icon" variant="ghost" title="View photos">
                      <Link to={`/admin/e/${event.id}/photos?guestId=${g.id}`} aria-label={`View photos by ${g.name}`}>
                        <Images />
                      </Link>
                    </Button>
                  )}
                  {isOwner && g.photoCount > 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Download originals"
                      aria-label={`Download photos by ${g.name}`}
                      onClick={() => download.mutate(g.id)}
                    >
                      <Download />
                    </Button>
                  )}
                  {g.access === 'APPROVED' ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Revoke gallery access"
                      aria-label={`Revoke access for ${g.name}`}
                      onClick={() => update.mutate({ id: g.id, body: { access: 'REJECTED' } })}
                    >
                      <UserX />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Grant gallery access"
                      aria-label={`Grant access to ${g.name}`}
                      onClick={() => update.mutate({ id: g.id, body: { access: 'APPROVED' } })}
                    >
                      <ShieldCheck />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    title={g.blocked ? 'Unblock' : 'Block uploads and access'}
                    aria-label={g.blocked ? `Unblock ${g.name}` : `Block ${g.name}`}
                    onClick={() => update.mutate({ id: g.id, body: { blocked: !g.blocked } })}
                  >
                    {g.blocked ? <Undo2 /> : <Ban className="text-destructive" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {list.isPending && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
        {!list.isPending && guests.length === 0 && (
          <p className="p-10 text-center text-sm text-muted-foreground">{q ? 'No matching guests.' : 'No guests yet.'}</p>
        )}
        {list.hasNextPage && (
          <div className="border-t p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
