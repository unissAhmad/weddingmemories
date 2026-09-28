import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Copy, Download, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { EventStats } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { api, apiUrl } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { formatBytes, formatEventDate } from '@/lib/utils';
import { useAdminEventContext } from './hooks';
import { PageHeader } from './PageHeader';

export function OverviewPage() {
  const { event, base } = useAdminEventContext();
  const stats = useQuery({
    queryKey: queryKeys.admin.stats(event.id),
    queryFn: ({ signal }) => api<EventStats>(`${base}/stats`, { signal }),
    refetchInterval: 30_000,
  });
  const s = stats.data;
  const published = s ? s.photos.READY : 0;

  return (
    <>
      <PageHeader
        title={event.name}
        description={formatEventDate(event.date)}
        actions={
          <>
            <Badge variant={event.settings.uploadsOpen ? 'success' : 'secondary'}>
              Uploads {event.settings.uploadsOpen ? 'open' : 'closed'}
            </Badge>
            {event.settings.moderateBeforePublish && <Badge variant="warning">Moderation on</Badge>}
            {event.settings.autoApprove && <Badge variant="accent">Auto-approve</Badge>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Guests" value={s?.guests} />
        <Stat label="Published photos" value={s ? published : undefined} />
        <Stat
          label="Awaiting access"
          value={s?.access.PENDING}
          link={s && s.access.PENDING > 0 ? `/admin/e/${event.id}/access` : undefined}
          highlight={Boolean(s && s.access.PENDING > 0)}
        />
        <Stat label="Storage" value={s ? formatBytes(s.storageBytes) : undefined} />
      </div>

      {s && (s.photos.HIDDEN > 0 || s.photos.PROCESSING > 0 || s.photos.FAILED > 0) && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {s.photos.HIDDEN > 0 && (
            <Link to={`/admin/e/${event.id}/photos?status=HIDDEN`}>
              <Badge variant="warning">{s.photos.HIDDEN} hidden / in review</Badge>
            </Link>
          )}
          {s.photos.PROCESSING > 0 && <Badge>{s.photos.PROCESSING} processing</Badge>}
          {s.photos.FAILED > 0 && <Badge variant="destructive">{s.photos.FAILED} failed</Badge>}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Table-card QR code</CardTitle>
          <CardDescription>Guests scan this to join. Print it on table cards and signs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <img
            src={apiUrl(`${base}/qr?format=svg`)}
            alt="QR code for the guest page"
            width={180}
            height={180}
            className="rounded-lg border bg-white p-2"
          />
          <div className="grid min-w-0 gap-3">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <code className="truncate text-sm">{event.guestUrl}</code>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Copy link"
                onClick={() => void navigator.clipboard.writeText(event.guestUrl).then(() => toast.success('Link copied'))}
              >
                <Copy />
              </Button>
              <Button asChild variant="ghost" size="icon" aria-label="Open guest page">
                <a href={event.guestUrl} target="_blank" rel="noreferrer">
                  <ExternalLink />
                </a>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={apiUrl(`${base}/qr?format=png`)} download>
                  <Download /> PNG (print)
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={apiUrl(`${base}/qr?format=svg`)} download>
                  <Download /> SVG (designers)
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Stat({
  label,
  value,
  link,
  highlight,
}: {
  label: string;
  value: number | string | undefined;
  link?: string;
  highlight?: boolean;
}) {
  const body = (
    <Card className={highlight ? 'border-accent/60' : undefined}>
      <CardContent className="p-5">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
        {value === undefined ? (
          <Skeleton className="mt-2 h-8 w-16" />
        ) : (
          <p className="mt-1 font-serif text-3xl">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        )}
      </CardContent>
    </Card>
  );
  return link ? <Link to={link}>{body}</Link> : body;
}
