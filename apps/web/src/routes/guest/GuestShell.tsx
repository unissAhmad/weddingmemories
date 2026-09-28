import { Link, NavLink, Navigate, Outlet, useOutletContext } from 'react-router';
import { Camera, Images, LogOut } from 'lucide-react';
import type { GuestMe } from '@wm/shared';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { useLogout, useMe } from '@/hooks/useMe';
import { cn } from '@/lib/utils';
import { useEventContext } from './EventLayout';

/** Signed-in area: header, content, and a thumb-reachable tab bar on phones. */
export function GuestShell() {
  const event = useEventContext();
  const me = useMe();
  const logout = useLogout();

  if (me.isPending) return <FullPageSpinner />;
  if (!me.data || me.data.event.id !== event.id) {
    return <Navigate to={`/e/${event.slug}/join`} replace />;
  }

  return (
    <div className="min-h-dvh pb-24 sm:pb-10">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5">
          <Link to={`/e/${event.slug}`} className="truncate font-serif text-xl">
            {event.name}
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Sections">
            <TabLink to="upload" icon={<Camera />} label="Share" />
            <TabLink to="gallery" icon={<Images />} label="Gallery" />
          </nav>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut />
          </Button>
        </div>
      </header>

      <Outlet context={{ event, me: me.data } satisfies GuestContext} />

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pt-2 backdrop-blur sm:hidden"
        aria-label="Sections"
      >
        <div className="mx-auto grid max-w-md grid-cols-2 px-6">
          <BottomTab to="upload" icon={<Camera />} label="Share" />
          <BottomTab to="gallery" icon={<Images />} label="Gallery" />
        </div>
      </nav>
    </div>
  );
}

export interface GuestContext {
  event: ReturnType<typeof useEventContext>;
  me: GuestMe;
}

export const useGuestContext = () => useOutletContext<GuestContext>();

function TabLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors [&_svg]:size-4',
          isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function BottomTab({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 py-1 text-xs font-medium [&_svg]:size-5',
          isActive ? 'text-foreground' : 'text-muted-foreground',
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
