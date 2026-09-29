import { cn } from '@/lib/utils';

/** Initials on a soft colour that stays the same for a given name. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        className,
      )}
      style={{ background: `hsl(${hue} 32% 52%)` }}
      aria-hidden
    >
      {initials || '?'}
    </span>
  );
}
