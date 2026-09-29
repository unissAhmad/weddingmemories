import { parseEventSettings, type PublicEvent } from '@wm/shared';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { listShowcase } from './showcase.service';
import { env } from '../env';

export async function getEventBySlug(slug: string) {
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) throw notFound('Event');
  return { ...event, settings: parseEventSettings(event.settings) };
}

export async function getEventById(id: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw notFound('Event');
  return { ...event, settings: parseEventSettings(event.settings) };
}

async function toPublicEvent(event: Awaited<ReturnType<typeof getEventBySlug>>): Promise<PublicEvent> {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    date: event.date.toISOString(),
    venue: event.venue,
    greeting: event.greeting,
    welcomeMessage: event.welcomeMessage,
    theme: event.settings.theme,
    showcase: await listShowcase(event.id),
    uploadsOpen: event.settings.uploadsOpen,
    maxUploadMb: env.MAX_UPLOAD_MB,
  };
}

export async function getPublicEvent(slug: string): Promise<PublicEvent> {
  return toPublicEvent(await getEventBySlug(slug));
}

/**
 * The event shown at the site root: the next upcoming one, otherwise the most recent.
 * Most installs have a single wedding, so this is simply "the" event.
 */
export async function getHomeEvent(): Promise<PublicEvent> {
  const now = new Date();
  const event =
    (await prisma.event.findFirst({ where: { date: { gte: new Date(now.getTime() - 3 * 86_400_000) } }, orderBy: { date: 'asc' } })) ??
    (await prisma.event.findFirst({ orderBy: { date: 'desc' } }));
  if (!event) throw notFound('Event');
  return toPublicEvent({ ...event, settings: parseEventSettings(event.settings) });
}
