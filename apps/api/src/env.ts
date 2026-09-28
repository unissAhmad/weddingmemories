import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),

  /** cloudinary://<api_key>:<api_secret>@<cloud_name> (Cloudinary dashboard → API Keys) */
  CLOUDINARY_URL: z
    .string()
    .regex(/^cloudinary:\/\/[^:]+:[^@]+@[\w-]+$/, 'Expected cloudinary://<api_key>:<api_secret>@<cloud_name>'),
  /** Top-level Cloudinary folder, so dev and production uploads never mix. */
  CLOUDINARY_FOLDER: z
    .string()
    .regex(/^[\w-]+$/)
    .default('wedding-memories'),

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

  /** Cloudinary's free plan accepts images up to 10 MB; paid plans allow 20 MB or more. */
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),

  /**
   * Public URL of this API, used for ZIP download links. They must reach the API directly: a
   * proxy in between (e.g. Netlify) would cut off long downloads. Render sets
   * RENDER_EXTERNAL_URL automatically.
   */
  PUBLIC_API_URL: z.url().optional(),
  RENDER_EXTERNAL_URL: z.url().optional(),
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
/** Empty string means "same origin as the request" (fine locally, where nothing proxies). */
export const publicApiUrl = (env.PUBLIC_API_URL ?? env.RENDER_EXTERNAL_URL ?? '').replace(/\/$/, '');
