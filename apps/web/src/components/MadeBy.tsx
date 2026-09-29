import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Maker's credit at the foot of the guest pages. */
export function MadeBy({ className }: { className?: string }) {
  return (
    <p className={cn('text-center text-xs text-muted-foreground', className)}>
      Handcrafted with{' '}
      <Heart className="inline size-3 -translate-y-px fill-red-500 text-red-500" aria-label="love" />{' '}
      by{' '}
      <a
        href="https://uniss-se.netlify.app/"
        target="_blank"
        rel="noopener"
        className="font-medium text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
      >
        U Niss
      </a>
    </p>
  );
}
