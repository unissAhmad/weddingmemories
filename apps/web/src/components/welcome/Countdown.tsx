import { useEffect, useState } from 'react';

const DAY = 86_400_000;

function parts(ms: number) {
  return {
    days: Math.floor(ms / DAY),
    hours: Math.floor((ms % DAY) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

/** Counts down to the wedding; on the day and afterwards it turns into a warm message. */
export function Countdown({ date }: { date: string }) {
  const target = new Date(date).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = target - now;
  const sameDay = new Date(target).toDateString() === new Date(now).toDateString();

  if (remaining <= 0 || sameDay) {
    const past = !sameDay;
    return (
      <p className="font-serif text-3xl text-balance sm:text-4xl">
        {past ? 'Thank you for celebrating with us' : 'Today is the day'}
      </p>
    );
  }

  const { days, hours, minutes, seconds } = parts(remaining);
  const units = [
    { value: days, label: days === 1 ? 'day' : 'days' },
    { value: hours, label: 'hours' },
    { value: minutes, label: 'minutes' },
    { value: seconds, label: 'seconds' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4" role="timer" aria-label={`${days} days until the wedding`}>
      {units.map((u) => (
        <div key={u.label} className="rounded-xl border bg-card/70 px-2 py-4 text-center shadow-xs sm:px-4">
          <div className="font-serif text-3xl leading-none tabular-nums sm:text-5xl">
            {String(u.value).padStart(2, '0')}
          </div>
          <div className="mt-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase sm:text-xs">{u.label}</div>
        </div>
      ))}
    </div>
  );
}
