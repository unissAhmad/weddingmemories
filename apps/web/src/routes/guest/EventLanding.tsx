import { Link } from 'react-router';
import { Camera, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Ornament } from '@/components/Ornament';
import { useMe } from '@/hooks/useMe';
import { formatEventDate } from '@/lib/utils';
import { useEventContext } from './EventLayout';

export function EventLanding() {
  const event = useEventContext();
  const me = useMe();
  const signedIn = me.data?.event.id === event.id;

  return (
    <main className="relative flex min-h-dvh flex-col">
      {event.coverUrl && (
        <div className="absolute inset-0 -z-10">
          <img src={event.coverUrl} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/75 to-background" />
        </div>
      )}

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="eyebrow">Our wedding memories</p>
        <Ornament className="my-6" />
        <h1 className="text-5xl leading-[1.05] font-medium text-balance sm:text-6xl">{event.name}</h1>
        <p className="mt-5 font-serif text-lg text-muted-foreground italic">
          {formatEventDate(event.date)}
        </p>
        <Ornament className="my-6" />
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          Every guest sees the day a little differently. Share the moments you captured and help us
          remember them all.
        </p>
      </div>

      <div className="safe-bottom mx-auto w-full max-w-md px-6 pb-6">
        <Button asChild size="lg" className="w-full">
          <Link to={signedIn ? 'upload' : 'join'}>
            <Camera />
            {signedIn ? 'Share your photos' : 'Join & share photos'}
          </Link>
        </Button>
        {signedIn ? (
          <Button asChild variant="ghost" className="mt-2 w-full">
            <Link to="gallery">
              <Images />
              View the gallery
            </Link>
          </Button>
        ) : (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            No app or password needed. Use the code on your invitation, or your email.
          </p>
        )}
      </div>
    </main>
  );
}
