import { z } from 'zod';

export const ErrorCodes = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CSRF',
  'NOT_FOUND',
  'CONFLICT',
  'DUPLICATE_PHOTO',
  'UPLOADS_CLOSED',
  'GUEST_BLOCKED',
  'ACCESS_REQUIRED',
  'ACCESS_REJECTED',
  'NO_FAMILY_CODE',
  'FAMILY_CODE_INVALID',
  'ACCESS_CODE_INVALID',
  'TOTP_REQUIRED',
  'TOTP_INVALID',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_TOO_MANY_ATTEMPTS',
  'RATE_LIMITED',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ErrorCodes)[number];

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
