import { useMemo } from 'react';
import { Camera, ChevronDown, Heart, Images, MapPin, Ticket } from 'lucide-react';
import type { PublicEvent, ShowcaseItem } from '@wm/shared';
import { Ornament } from '@/components/Ornament';
import { HeroSlideshow } from '@/components/welcome/HeroSlideshow';
import { Countdown } from '@/components/welcome/Countdown';
import { Reveal } from '@/components/welcome/Reveal';
import { JoinBar } from '@/components/welcome/JoinBar';
import { MadeBy } from '@/components/MadeBy';
import { Masonry } from '@/components/gallery/Masonry';
import { useLightbox } from '@/components/gallery/useLightbox';
import { useMe } from '@/hooks/useMe';
import { useEventTheme } from '@/hooks/useEventTheme';
import { cn, formatEventDate } from '@/lib/utils';

const DEFAULT_GREETING = 'Welcome to the wedding of';
const DEFAULT_MESSAGE =
  'Thank you for being here and for being part of our story. Every guest sees the day a little differently, so please share the moments you capture. Together they will become the memories we treasure for the rest of our lives.';

/** "Aisha & Omar" / "Aisha and Omar" → ["Aisha", "Omar"], so the ampersand can be styled. */
function splitNames(name: string): [string, string] | null {
  const parts = name.split(/\s+(?:&|and|\+)\s+/i);
  return parts.length === 2 ? [parts[0]!, parts[1]!] : null;
}

function initials(name: string) {
  const pair = splitNames(name);
  return pair ? `${pair[0][0]}${pair[1][0]}` : name.slice(0, 2);
}

function CoupleNames({ name, className }: { name: string; className?: string }) {
  const pair = splitNames(name);
  return (
    <h1 className={cn('font-serif leading-[0.95] font-medium text-balance', className)}>
      {pair ? (
        <>
          <span className="block">{pair[0]}</span>
          <span className="my-1 block font-normal italic opacity-80 [font-size:0.55em]">&amp;</span>
          <span className="block">{pair[1]}</span>
        </>
      ) : (
        name
      )}
    </h1>
  );
}

export function WelcomePage({ event }: { event: PublicEvent }) {
  useEventTheme(event.theme);
  const me = useMe();
  const signedIn = me.data?.event.id === event.id;
  const hasPhotos = event.showcase.length > 0;
  const date = formatEventDate(event.date);

  return (
    <div className="min-h-dvh pb-28">
      {/* Hero */}
      <header
        className={cn(
          'relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 text-center',
          hasPhotos ? 'text-white' : 'bg-background',
        )}
      >
        {hasPhotos ? (
          <>
            <HeroSlideshow photos={event.showcase} />
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/70" aria-hidden />
          </>
        ) : (
          <TypographicBackdrop monogram={initials(event.name)} />
        )}

        <div className="relative z-10 flex max-w-xl flex-col items-center">
          <p className={cn('animate-soft-fade-up text-[11px] font-medium tracking-[0.35em] uppercase sm:text-xs', hasPhotos ? 'text-white/85' : 'text-muted-foreground')}>
            {event.greeting || DEFAULT_GREETING}
          </p>
          <Ornament className={cn('my-6 animate-soft-fade-up [animation-delay:120ms]', hasPhotos && 'text-white/80')} />
          <CoupleNames name={event.name} className="animate-soft-fade-up text-6xl [animation-delay:200ms] sm:text-8xl" />
          <Ornament className={cn('my-6 animate-soft-fade-up [animation-delay:320ms]', hasPhotos && 'text-white/80')} />
          <p className="animate-soft-fade-up font-serif text-xl italic [animation-delay:400ms] sm:text-2xl">{date}</p>
          {event.venue && (
            <p className={cn('mt-3 flex animate-soft-fade-up items-center gap-1.5 text-sm [animation-delay:480ms]', hasPhotos ? 'text-white/85' : 'text-muted-foreground')}>
              <MapPin className="size-4" /> {event.venue}
            </p>
          )}
          {signedIn && (
            <p className={cn('mt-6 animate-soft-fade-up text-sm [animation-delay:560ms]', hasPhotos ? 'text-white/85' : 'text-muted-foreground')}>
              Welcome back, {me.data!.guest.name.split(' ')[0]}
            </p>
          )}
        </div>

        <a
          href="#welcome"
          aria-label="Scroll down"
          className={cn('absolute bottom-28 z-10 animate-cue rounded-full p-2', hasPhotos ? 'text-white/80' : 'text-muted-foreground')}
        >
          <ChevronDown className="size-6" />
        </a>
      </header>

      {/* Personal welcome */}
      <section id="welcome" className="mx-auto max-w-2xl scroll-mt-10 px-6 py-24 text-center">
        <Reveal>
          <Heart className="mx-auto size-6 text-accent" strokeWidth={1.25} />
          <p className="eyebrow mt-6">Dear family &amp; friends</p>
          <p className="mt-6 font-serif text-2xl leading-relaxed text-balance whitespace-pre-line sm:text-3xl">
            {event.welcomeMessage || DEFAULT_MESSAGE}
          </p>
          <p className="mt-8 font-serif text-xl text-muted-foreground italic">With love, {event.name}</p>
        </Reveal>
      </section>

      {/* Countdown */}
      <section className="border-y bg-secondary/40 px-6 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-8">{new Date(event.date).getTime() > Date.now() ? 'Counting down to the day' : 'Our wedding day'}</p>
          <Countdown date={event.date} />
          <p className="mt-8 font-serif text-lg text-muted-foreground italic">{date}</p>
        </Reveal>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <Reveal className="text-center">
          <p className="eyebrow">Share the day</p>
          <h2 className="mt-3 text-4xl sm:text-5xl">Be part of our memories</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-3 sm:gap-6">
          {[
            { icon: <Ticket />, title: 'Join in seconds', body: 'Use the code on your invitation, or your email. No app, no password.' },
            { icon: <Camera />, title: 'Share your photos', body: 'Add the moments you captured, straight from your phone, in full quality.' },
            { icon: <Images />, title: 'Relive it together', body: "See the day through everyone's eyes in one beautiful gallery." },
          ].map((step, i) => (
            <Reveal key={step.title} delay={i * 120}>
              {/* Compact row on phones, centred card from tablet up */}
              <div className="flex h-full items-start gap-4 rounded-2xl border bg-card p-5 shadow-xs sm:flex-col sm:items-center sm:p-7 sm:text-center">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/12 text-accent [&_svg]:size-5">
                  {step.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs tracking-[0.25em] text-muted-foreground">0{i + 1}</p>
                  <h3 className="mt-1 text-2xl sm:mt-3">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The couple's photos */}
      {hasPhotos && <OurMoments photos={event.showcase} />}

      <footer className="px-6 py-16 text-center">
        <Ornament />
        <p className="mt-6 font-serif text-3xl">{event.name}</p>
        <p className="mt-2 text-sm text-muted-foreground">{date}</p>
        <MadeBy className="mt-10" />
      </footer>

      <JoinBar slug={event.slug} signedIn={signedIn} />
    </div>
  );
}

function OurMoments({ photos }: { photos: ShowcaseItem[] }) {
  const items = useMemo(
    () =>
      photos.map((p) => ({
        src: p.url,
        msrc: p.thumbUrl,
        width: p.width ?? 1600,
        height: p.height ?? 1200,
        caption: p.caption ?? undefined,
      })),
    [photos],
  );
  const open = useLightbox(items);

  return (
    <section className="mx-auto max-w-5xl px-3 pb-24 sm:px-6">
      <Reveal className="mb-10 text-center">
        <p className="eyebrow">Our story</p>
        <h2 className="mt-3 text-4xl sm:text-5xl">Our moments</h2>
      </Reveal>
      <Masonry
        items={photos}
        getKey={(p) => p.id}
        getRatio={(p) => (p.height && p.width ? p.height / p.width : 1.25)}
        render={(p, i) => (
          <Reveal delay={(i % 3) * 80}>
            <button
              type="button"
              onClick={() => open(i)}
              className="group relative block w-full overflow-hidden rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={p.caption ? `Open photo: ${p.caption}` : 'Open photo'}
            >
              <img
                src={p.thumbUrl}
                alt={p.caption ?? ''}
                width={p.width ?? undefined}
                height={p.height ?? undefined}
                loading="lazy"
                className="w-full bg-muted object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                style={{
                  aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : '4 / 5',
                  backgroundImage: `url(${p.placeholderUrl})`,
                  backgroundSize: 'cover',
                }}
              />
              {p.caption && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-8 pb-2 text-left font-serif text-sm text-white italic">
                  {p.caption}
                </span>
              )}
            </button>
          </Reveal>
        )}
      />
    </section>
  );
}

/** Hero backdrop when the couple hasn't added photos yet: soft glows and a large monogram. */
function TypographicBackdrop({ monogram }: { monogram: string }) {
  return (
    <div className="absolute inset-0 -z-10" aria-hidden>
      <div className="absolute -top-40 -left-32 size-[28rem] rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute -right-32 -bottom-40 size-[30rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-[46vw] leading-none text-foreground/[0.035] select-none sm:text-[28rem]">
          {monogram}
        </span>
      </div>
      <div className="absolute inset-6 rounded-[2rem] border border-accent/25 sm:inset-10" />
    </div>
  );
}
