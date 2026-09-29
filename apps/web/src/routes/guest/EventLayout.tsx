import { Outlet, useOutletContext, useParams } from 'react-router';
import type { PublicEvent } from '@wm/shared';
import { useEvent } from '@/hooks/useEvent';
import { useEventTheme } from '@/hooks/useEventTheme';
import { isApiError } from '@/lib/api';
import { rememberEvent } from '@/lib/lastEvent';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/FullPageSpinner';

export function EventLayout() {
  const { slug = '' } = useParams();
  const event = useEvent(slug);
  useEventTheme(event.data?.theme);

  if (event.isPending) return <FullPageSpinner />;

  if (event.isError) {
    const missing = isApiError(event.error) && (event.error.status === 404 || event.error.status === 400);
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl">{missing ? 'Event not found' : 'Something went wrong'}</h1>
        <p className="text-muted-foreground">
          {missing
            ? 'Please scan the QR code on your table card again.'
            : "We couldn't load this page. Check your connection and try again."}
        </p>
        {!missing && <Button onClick={() => void event.refetch()}>Try again</Button>}
      </main>
    );
  }

  rememberEvent(event.data.slug);
  return <Outlet context={event.data} />;
}

export const useEventContext = () => useOutletContext<PublicEvent>();
