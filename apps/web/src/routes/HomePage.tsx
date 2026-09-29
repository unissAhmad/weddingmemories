import { Navigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import type { PublicEvent } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { Ornament } from '@/components/Ornament';
import { api, isApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { lastEvent } from '@/lib/lastEvent';
import { WelcomePage } from './guest/WelcomePage';

/** The site root welcomes guests to the wedding directly, no QR code needed. */
export function HomePage() {
  const remembered = lastEvent();
  const home = useQuery({
    queryKey: queryKeys.homeEvent,
    queryFn: ({ signal }) => api<PublicEvent>('/events/home', { signal }),
    staleTime: 5 * 60_000,
  });

  if (home.isPending) return <FullPageSpinner />;

  // Guests who joined a different event (rare: multi-event installs) go back to theirs.
  if (home.data && remembered && remembered !== home.data.slug) {
    return <Navigate to={`/e/${remembered}`} replace />;
  }
  if (home.data) return <WelcomePage event={home.data} />;

  const noEvent = isApiError(home.error) && home.error.status === 404;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Heart className="size-8 text-accent" strokeWidth={1.25} />
      <h1 className="text-4xl">Wedding Memories</h1>
      <Ornament />
      <p className="text-muted-foreground">
        {noEvent ? 'The celebration page is being prepared. Please check back soon.' : "We couldn't load the page."}
      </p>
      {!noEvent && <Button onClick={() => void home.refetch()}>Try again</Button>}
    </main>
  );
}
