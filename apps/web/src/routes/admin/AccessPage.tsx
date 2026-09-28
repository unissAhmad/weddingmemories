import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { AccessStatus, AdminAccessRequest, Page } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { formatDateTime, useAdminEventContext } from './hooks';
import { PageHeader } from './PageHeader';
import { headerCheckState, useSelection } from './useSelection';

const TABS: { status: AccessStatus; label: string }[] = [
  { status: 'PENDING', label: 'Waiting' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Declined' },
];

export function AccessPage() {
  const { event, base } = useAdminEventContext();
  const [status, setStatus] = useState<AccessStatus>('PENDING');
  const selection = useSelection();
  const qc = useQueryClient();

  const list = useInfiniteQuery({
    queryKey: queryKeys.admin.access(event.id, status),
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ status, limit: '50' });
      if (pageParam) qs.set('cursor', pageParam);
      return api<Page<AdminAccessRequest>>(`${base}/access?${qs}`, { signal });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (p) => p.nextCursor,
    refetchInterval: status === 'PENDING' ? 20_000 : false,
  });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];

  const decide = useMutation({
    mutationFn: (vars: { ids: string[]; status: 'APPROVED' | 'REJECTED' }) =>
      api<{ updated: number }>(`${base}/access/decide`, { method: 'POST', body: vars }),
    onSuccess: (res, vars) => {
      toast.success(
        `${res.updated} ${res.updated === 1 ? 'guest' : 'guests'} ${vars.status === 'APPROVED' ? 'approved' : 'declined'}`,
      );
      selection.clear();
      void qc.invalidateQueries({ queryKey: ['admin', 'event', event.id] });
    },
    onError: (err) => toast.error(err.message),
  });

  const act = (target: 'APPROVED' | 'REJECTED', ids = selection.ids) => decide.mutate({ ids, status: target });

  return (
    <>
      <PageHeader
        title="Gallery access"
        description="Guests can always upload. Only approved guests can see everyone's photos."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border bg-card p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.status}
              role="tab"
              aria-selected={status === t.status}
              onClick={() => {
                setStatus(t.status);
                selection.clear();
              }}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm transition-colors',
                status === t.status ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {selection.count > 0 && (
          <div className="flex gap-2">
            {status !== 'APPROVED' && (
              <Button size="sm" onClick={() => act('APPROVED')} disabled={decide.isPending}>
                <Check /> Approve {selection.count}
              </Button>
            )}
            {status !== 'REJECTED' && (
              <Button size="sm" variant="outline" onClick={() => act('REJECTED')} disabled={decide.isPending}>
                <X /> Decline {selection.count}
              </Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all"
                  checked={headerCheckState(selection.count, rows.length)}
                  onCheckedChange={(v) => selection.setAll(rows.map((r) => r.id), v === true)}
                />
              </TableHead>
              <TableHead>Guest</TableHead>
              <TableHead className="hidden sm:table-cell">Requested</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} data-state={selection.selected.has(r.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${r.guestName}`}
                    checked={selection.selected.has(r.id)}
                    onCheckedChange={() => selection.toggle(r.id)}
                  />
                </TableCell>
                <TableCell>
                  <p className="font-medium">{r.guestName}</p>
                  <p className="text-xs text-muted-foreground">{r.contact ?? 'Access-code guest'}</p>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDateTime(r.createdAt)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {status !== 'APPROVED' && (
                    <Button size="sm" variant="ghost" onClick={() => act('APPROVED', [r.id])} disabled={decide.isPending}>
                      Approve
                    </Button>
                  )}
                  {status !== 'REJECTED' && (
                    <Button size="sm" variant="ghost" onClick={() => act('REJECTED', [r.id])} disabled={decide.isPending}>
                      {status === 'APPROVED' ? 'Revoke' : 'Decline'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {list.isPending && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
        {!list.isPending && rows.length === 0 && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {status === 'PENDING' ? 'No one is waiting. 🎉' : 'Nothing here yet.'}
          </p>
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
