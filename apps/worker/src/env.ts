import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1),

  /** cloudinary://<api_key>:<api_secret>@<cloud_name> */
  CLOUDINARY_URL: z.string().regex(/^cloudinary:\/\/[^:]+:[^@]+@[\w-]+$/),

  /** Photos processed in parallel (each job is two small HTTP requests to Cloudinary). */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
  throw new Error(`Invalid environment variables:\n${issues.join('\n')}`);
}

export const env = parsed.data;
