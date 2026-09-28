import { z } from 'zod';

export const EventSettingsSchema = z.object({
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

export const PublicEventSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  date: z.string(),
  coverUrl: z.string().nullable(),
  uploadsOpen: z.boolean(),
  maxUploadMb: z.number(),
});

export type PublicEvent = z.infer<typeof PublicEventSchema>;
