import { z } from 'zod';
import { SlugSchema } from './event';
import { GuestNameSchema } from './guest';

/** No 0/O, 1/I/L: codes are read off printed invitations and typed on phones. */
export const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ACCESS_CODE_LENGTH = 8;

/** "ab7k-2mq9 " → "AB7K2MQ9". Dashes and spaces are cosmetic. */
export function normalizeAccessCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Groups a normalized code for display: "AB7K-2MQ9". */
export function formatAccessCode(code: string) {
  const c = normalizeAccessCode(code);
  return c.length === ACCESS_CODE_LENGTH ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/**
 * Names are compared loosely: case, accents, dots and extra spaces don't matter, so
 * "  josé  d'souza" matches "Jose D'Souza". Everything else must match.
 */
export function normalizeGuestName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const AccessCodeLoginSchema = z.object({
  slug: SlugSchema,
  name: GuestNameSchema,
  code: z
    .string()
    .trim()
    .min(1, 'Enter your access code')
    .max(32)
    .transform(normalizeAccessCode)
    .refine((c) => c.length === ACCESS_CODE_LENGTH, 'Access codes have 8 letters and numbers'),
});

export type AccessCodeLoginInput = z.input<typeof AccessCodeLoginSchema>;
export type AccessCodeLogin = z.output<typeof AccessCodeLoginSchema>;

export const CreateCodeGuestsSchema = z.object({
  names: z.array(GuestNameSchema).min(1, 'Add at least one name').max(500),
});

export type CreateCodeGuests = z.infer<typeof CreateCodeGuestsSchema>;

export interface CodeGuest {
  id: string;
  name: string;
  code: string;
}
