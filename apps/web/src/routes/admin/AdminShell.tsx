import { Link, Navigate, NavLink, Outlet, useMatch, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Download,
  Images,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import type { AdminMe } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAdminEvents, useAdminMe } from './hooks';

export function AdminShell() {
  const me = useAdminMe();
  const events = useAdminEvents(Boolean(me.data));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const match = useMatch('/admin/e/:eventId/*');
  const eventId = match?.params.eventId;

  const logout = useMutation({
    mutationFn: () => api<void>('/admin/logout', { method: 'POST' }),
    onSettled: () => {
      qc.removeQueries({ queryKey: ['admin'] });
      navigate('/admin/login', { replace: true });
    },
  });

  if (me.isPending) return <FullPageSpinner />;
  if (!me.data) return <Navigate to="/admin/login" replace />;

  const isOwner = me.data.role === 'OWNER';

  return (
    <div className="min-h-dvh bg-muted/30 lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b bg-card lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-center justify-between gap-2">
            <Link to="/admin" className="font-serif text-xl">
              Wedding Memories
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => logout.mutate()} aria-label="Sign out">
              <LogOut />
            </Button>
          </div>

          {events.data && events.data.length > 1 && (
            <NativeSelect
              aria-label="Event"
              value={eventId ?? ''}
              onChange={(e) => e.target.value && navigate(`/admin/e/${e.target.value}`)}
            >
              <option value="" disabled>
                Choose event…
              </option>
              {events.data.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </NativeSelect>
          )}

          {eventId && (
            <nav className="-mx-1 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Event">
              <Item to={`/admin/e/${eventId}`} end icon={<LayoutDashboard />} label="Overview" />
              <Item to={`/admin/e/${eventId}/access`} icon={<UserCheck />} label="Access" />
              <Item to={`/admin/e/${eventId}/photos`} icon={<Images />} label="Photos" />
              <Item to={`/admin/e/${eventId}/guests`} icon={<Users />} label="Guests" />
              {isOwner && (
                <>
                  <Item to={`/admin/e/${eventId}/downloads`} icon={<Download />} label="Downloads" />
                  <Item to={`/admin/e/${eventId}/settings`} icon={<Settings />} label="Settings" />
                  <Item to={`/admin/e/${eventId}/audit`} icon={<ClipboardList />} label="Audit log" />
                </>
              )}
            </nav>
          )}

          <div className="mt-auto hidden flex-col gap-1 lg:flex">
            {isOwner && <Item to="/admin/team" icon={<ShieldCheck />} label="Team" />}
            <AccountBox me={me.data} onLogout={() => logout.mutate()} />
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}

function AccountBox({ me, onLogout }: { me: AdminMe; onLogout: () => void }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm">{me.email}</p>
        <p className="text-xs text-muted-foreground capitalize">{me.role.toLowerCase()}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Sign out" title="Sign out">
        <LogOut />
      </Button>
    </div>
  );
}

function Item({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors [&_svg]:size-4',
          isActive ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
