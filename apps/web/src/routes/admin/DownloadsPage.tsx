import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminDownloadJob } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
    refetchInterval: (q) =>
      q.state.data?.some((j) => j.status === 'QUEUED' || j.status === 'RUNNING') ? 3000 : false,
  });

  const create = useMutation({
    mutationFn: () => api(`${base}/downloads`, { method: 'POST', body: { scope: { type: 'all' } } }),
    onSuccess: () => {
      toast.success("Started. We'll email you the link when it's ready.");
      void qc.invalidateQueries({ queryKey: queryKeys.admin.downloads(event.id) });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Downloads"
        description="Original, full-quality files in folders by guest. Large events are split into ~2 GB parts. Links last 24 hours."
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
                    {j.photoCount} photos · {formatBytes(j.totalBytes)} · requested {formatDateTime(j.createdAt)}
                  </p>
                </div>
                <JobBadge job={j} />
              </div>

              {(j.status === 'RUNNING' || j.status === 'QUEUED') && (
                <div className="grid gap-1">
                  <Progress value={j.photoCount ? (j.doneCount / j.photoCount) * 100 : 0} />
                  <p className="text-xs text-muted-foreground">
                    {j.status === 'QUEUED' ? 'Waiting to start…' : `${j.doneCount} of ${j.photoCount} added`}
                  </p>
                </div>
              )}

              {j.parts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {j.parts.map((p) => (
                    <Button key={p.url} asChild variant="outline" size="sm">
                      <a href={p.url} download={p.name}>
                        <Download /> {p.name}
                      </a>
                    </Button>
                  ))}
                </div>
              )}
              {j.status === 'DONE' && j.expiresAt && !j.expired && (
                <p className="text-xs text-muted-foreground">Links expire {formatDateTime(j.expiresAt)}.</p>
              )}
              {j.error && <p className="text-sm text-destructive">{j.error}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function JobBadge({ job }: { job: AdminDownloadJob }) {
  if (job.status === 'DONE') return job.expired ? <Badge>Expired</Badge> : <Badge variant="success">Ready</Badge>;
  if (job.status === 'FAILED') return <Badge variant="destructive">Failed</Badge>;
  if (job.status === 'RUNNING') return <Badge variant="accent">Building…</Badge>;
  return <Badge>Queued</Badge>;
}
