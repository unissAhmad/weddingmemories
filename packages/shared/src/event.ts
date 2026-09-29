import { z } from 'zod';

/** Colour themes for the guest pages (see apps/web/src/index.css). */
export const THEMES = ['ivory', 'blush', 'sage', 'midnight'] as const;
export type Theme = (typeof THEMES)[number];

export const EventSettingsSchema = z.object({
  theme: z.enum(THEMES).default('ivory'),
  autoApprove: z.boolean().default(false),
  moderateBeforePublish: z.boolean().default(false),
  uploadsOpen: z.boolean().default(true),
  familyCodeHash: z.string().nullable().default(null),
});

export type EventSettings = z.infer<typeof EventSettingsSchema>;

/** Parse the untyped `Event.settings` JSON column, filling defaults for missing keys. */
export function parseEventSettings(raw: unknown): EventSettings {
  const result = EventSettingsSchema.safeParse(raw ?? {});
  return result.success ? result.data : EventSettingsSchema.parse({});
}

export const SlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid event link');

export const EventSlugParamsSchema = z.object({ slug: SlugSchema });

/** A photo the couple chose for the welcome page. URLs are signed Cloudinary renditions. */
export interface ShowcaseItem {
  id: string;
  /** Large rendition for the hero slideshow and lightbox */
  url: string;
  /** Smaller rendition for the gallery grid */
  thumbUrl: string;
  /** Tiny blurred rendition shown while loading */
  placeholderUrl: string;
  width: number | null;
  height: number | null;
  caption: string | null;
}

export interface PublicEvent {
  id: string;
  slug: string;
  name: string;
  date: string;
  venue: string | null;
  greeting: string | null;
  welcomeMessage: string | null;
  theme: Theme;
  showcase: ShowcaseItem[];
  uploadsOpen: boolean;
  maxUploadMb: number;
}
