import { Link } from 'react-router';
import { Camera, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Always-visible call to action, floating over the page (no bar behind it, so it sits nicely
 * on photos and plain sections alike). Only the buttons catch taps; the rest scrolls through.
 */
export function JoinBar({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const floating = 'shadow-[0_10px_30px_-8px_rgb(0_0_0/0.45)] ring-1 ring-white/25';
  return (
    <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 pt-3">
      <div className="pointer-events-auto mx-auto flex max-w-md gap-2 px-5">
        {signedIn ? (
          <>
            <Button asChild size="lg" className={`flex-1 ${floating}`}>
              <Link to={`/e/${slug}/upload`}>
                <Camera /> Share photos
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className={`flex-1 ${floating}`}>
              <Link to={`/e/${slug}/gallery`}>
                <Images /> Gallery
              </Link>
            </Button>
          </>
        ) : (
          <Button asChild size="lg" className={`w-full ${floating}`}>
            <Link to={`/e/${slug}/join`}>
              <Camera /> Join &amp; share photos
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
