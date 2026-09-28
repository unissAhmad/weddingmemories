import { parseEventSettings, type PublicEvent } from '@wm/shared';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { signedGetUrl } from '../lib/r2';
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

export async function getPublicEvent(slug: string): Promise<PublicEvent> {
  const event = await getEventBySlug(slug);
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    date: event.date.toISOString(),
    coverUrl: event.coverKey ? await signedGetUrl(event.coverKey) : null,
    uploadsOpen: event.settings.uploadsOpen,
    maxUploadMb: env.MAX_UPLOAD_MB,
  };
}
