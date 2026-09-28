import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  /** Override for local S3-compatible storage (e.g. MinIO). Defaults to the R2 endpoint. */
  R2_ENDPOINT: z.url().optional(),

  JWT_SECRET_GUEST: z.string().min(32),
  JWT_SECRET_ADMIN: z.string().min(32),
  OTP_SECRET: z.string().min(32),

  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Wedding Memories <photos@example.com>'),

  /** Comma-separated list of allowed web origins. */
  WEB_ORIGIN: z.string().min(1),
  /** Public guest-facing URL used in QR codes and emails. Defaults to the first WEB_ORIGIN. */
  PUBLIC_WEB_URL: z.url().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  /** Number of proxy hops in front of the API (Render = 1). */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${issues.join('\n')}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const webOrigins = env.WEB_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''));
export const maxUploadBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
export const publicWebUrl = (env.PUBLIC_WEB_URL ?? webOrigins[0]!).replace(/\/$/, '');
export const guestEventUrl = (slug: string) => `${publicWebUrl}/e/${slug}`;
