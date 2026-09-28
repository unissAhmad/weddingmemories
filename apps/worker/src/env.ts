import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),

  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_ENDPOINT: z.url().optional(),

  /** Photos processed in parallel. Each can use ~300-500 MB for large phone photos. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),

  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Wedding Memories <photos@example.com>'),
  /** Used for links in emails; first entry of WEB_ORIGIN if not set. */
  PUBLIC_WEB_URL: z.url().optional(),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Invalid environment variables:\n${issues.join('\n')}`);
}

export const env = parsed.data;
export const publicWebUrl = (env.PUBLIC_WEB_URL ?? env.WEB_ORIGIN.split(',')[0]!.trim()).replace(/\/$/, '');
