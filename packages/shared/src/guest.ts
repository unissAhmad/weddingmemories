import { z } from 'zod';
import { OTP_LENGTH } from './constants';
import { SlugSchema } from './event';

export const GuestNameSchema = z.string().trim().min(1, 'Please enter your name').max(80);

export const GuestEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Please enter a valid email'));

export const OtpRequestSchema = z.object({
  slug: SlugSchema,
  name: GuestNameSchema,
  email: GuestEmailSchema,
});

export type OtpRequest = z.infer<typeof OtpRequestSchema>;

export const OtpCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code`);

export const OtpVerifySchema = OtpRequestSchema.extend({ code: OtpCodeSchema });

export type OtpVerify = z.infer<typeof OtpVerifySchema>;

export const AccessStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type AccessStatus = z.infer<typeof AccessStatusSchema>;

export const GuestMeSchema = z.object({
  guest: z.object({
    id: z.string(),
    name: z.string(),
    /** Email, or null for guests who signed in with an access code */
    contact: z.string().nullable(),
  }),
  event: z.object({
    id: z.string(),
    slug: z.string(),
  }),
  access: AccessStatusSchema.nullable(),
});

export type GuestMe = z.infer<typeof GuestMeSchema>;
