import { Navigate, Outlet, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import type { AdminEventDetail } from '@wm/shared';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { api, isApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAdminMe, type AdminEventContext } from './hooks';

export function EventAdminLayout() {
  const { eventId = '' } = useParams();
  const me = useAdminMe();
  const base = `/admin/events/${eventId}`;
  const event = useQuery({
    queryKey: queryKeys.admin.event(eventId),
    queryFn: ({ signal }) => api<AdminEventDetail>(base, { signal }),
  });

  if (event.isPending || !me.data) return <FullPageSpinner />;
  if (event.isError) {
    if (isApiError(event.error) && event.error.status === 404) return <Navigate to="/admin" replace />;
    return <p className="p-10 text-muted-foreground">{event.error.message}</p>;
  }

  const ctx: AdminEventContext = { me: me.data, event: event.data, isOwner: me.data.role === 'OWNER', base };
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-10">
      <Outlet context={ctx} />
    </main>
  );
}
