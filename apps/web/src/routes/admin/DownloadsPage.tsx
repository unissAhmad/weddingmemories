import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminDownloadJob } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { formatBytes } from '@/lib/utils';
import { formatDateTime, useAdminEventContext } from './hooks';
import { PageHeader } from './PageHeader';

const SCOPE_LABEL = { all: 'All photos', guest: "One guest's photos", selection: 'Selected photos' } as const;

export function DownloadsPage() {
  const { event, base } = useAdminEventContext();
  const qc = useQueryClient();

  const jobs = useQuery({
    queryKey: queryKeys.admin.downloads(event.id),
    queryFn: ({ signal }) => api<AdminDownloadJob[]>(`${base}/downloads`, { signal }),
  });

  const create = useMutation({
    mutationFn: () => api(`${base}/downloads`, { method: 'POST', body: { scope: { type: 'all' } } }),
    onSuccess: () => {
      toast.success('Download ready. Click each part to save it.');
      void qc.invalidateQueries({ queryKey: queryKeys.admin.downloads(event.id) });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Downloads"
        description="Original, full-quality files in folders by guest. Large events are split into ~2 GB parts that start downloading immediately. Links last 24 hours."
        actions={
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Archive />}
            Download all photos
          </Button>
        }
      />

      {jobs.isPending && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
      {jobs.data?.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No downloads yet. You can also download one guest's photos from Guests, or a selection from Photos.
        </p>
      )}

      <div className="grid gap-3">
        {jobs.data?.map((j) => (
          <Card key={j.id}>
            <CardContent className="grid gap-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{SCOPE_LABEL[j.scope.type]}</p>
                  <p className="text-xs text-muted-foreground">
                    {j.photoCount} photos · {formatBytes(j.totalBytes)} · created {formatDateTime(j.createdAt)}
                  </p>
                </div>
                {j.expired ? <Badge>Expired</Badge> : <Badge variant="success">Ready</Badge>}
              </div>

              {j.parts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {j.parts.map((p) => (
                    <Button key={p.url} asChild variant="outline" size="sm">
                      {/* Opens on the API's own domain: long downloads must not go through a proxy. */}
                      <a href={p.url} download={p.name}>
                        <Download /> {p.name}
                        {j.parts.length > 1 && <span className="text-muted-foreground">({p.photoCount})</span>}
                      </a>
                    </Button>
                  ))}
                </div>
              )}
              {!j.expired && j.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Links work until {formatDateTime(j.expiresAt)}. Each part downloads on its own; you don't
                  need to keep this page open.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
