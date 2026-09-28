import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { AuditEntry, Page } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { formatDateTime, useAdminEventContext } from './hooks';
import { PageHeader } from './PageHeader';

function summarize(meta: unknown) {
  if (!meta || typeof meta !== 'object') return '';
  const m = meta as Record<string, unknown>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(m)) {
    if (Array.isArray(v)) parts.push(`${k}: ${v.length}`);
    else if (v && typeof v === 'object') parts.push(`${k}: ${JSON.stringify(v)}`);
    else parts.push(`${k}: ${String(v)}`);
  }
  return parts.join(' · ');
}

export function AuditPage() {
  const { event, base } = useAdminEventContext();
  const log = useInfiniteQuery({
    queryKey: queryKeys.admin.audit(event.id),
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ limit: '50' });
      if (pageParam) qs.set('cursor', pageParam);
      return api<Page<AuditEntry>>(`${base}/audit?${qs}`, { signal });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (p) => p.nextCursor,
  });
  const rows = log.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader title="Audit log" description="Every change made by an admin, newest first." />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="hidden md:table-cell">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</TableCell>
                <TableCell>{r.adminEmail ?? 'removed admin'}</TableCell>
                <TableCell>
                  <code className="text-xs">{r.action}</code>
                </TableCell>
                <TableCell className="hidden max-w-md truncate text-xs text-muted-foreground md:table-cell">
                  {summarize(r.meta)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {log.isPending && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
        {log.hasNextPage && (
          <div className="border-t p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => void log.fetchNextPage()} disabled={log.isFetchingNextPage}>
              Load more
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
