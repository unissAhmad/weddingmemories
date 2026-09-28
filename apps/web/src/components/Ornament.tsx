import { cn } from '@/lib/utils';

/** A thin rule with a small diamond in the middle, used between headings. */
export function Ornament({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 text-accent', className)} aria-hidden>
      <span className="h-px w-12 bg-current opacity-50" />
      <span className="size-1.5 rotate-45 bg-current" />
      <span className="h-px w-12 bg-current opacity-50" />
    </div>
  );
}
