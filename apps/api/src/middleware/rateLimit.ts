import {
  rateLimit,
  ipKeyGenerator,
  type ClientRateLimitInfo,
  type Options,
  type Store,
} from 'express-rate-limit';
import type { Request } from 'express';
import type { ApiErrorBody } from '@wm/shared';
import { prisma } from '../lib/prisma';

/** Fixed-window counter in Postgres, so limits hold across API instances without Redis. */
class PostgresStore implements Store {
  windowMs = 60_000;
  localKeys = false;

  constructor(public prefix: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  private key(key: string) {
    return `${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const resetAt = new Date(Date.now() + this.windowMs);
    const rows = await prisma.$queryRaw<{ hits: number; resetAt: Date }[]>`
      INSERT INTO "RateLimitHit" ("key", "hits", "resetAt")
      VALUES (${this.key(key)}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "hits"    = CASE WHEN "RateLimitHit"."resetAt" <= now() THEN 1 ELSE "RateLimitHit"."hits" + 1 END,
        "resetAt" = CASE WHEN "RateLimitHit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimitHit"."resetAt" END
      RETURNING "hits", "resetAt"`;
    const row = rows[0]!;
    return { totalHits: row.hits, resetTime: row.resetAt };
  }

  async decrement(key: string) {
    await prisma.$executeRaw`
      UPDATE "RateLimitHit" SET "hits" = GREATEST("hits" - 1, 0) WHERE "key" = ${this.key(key)}`;
  }

  async resetKey(key: string) {
    await prisma.$executeRaw`DELETE FROM "RateLimitHit" WHERE "key" = ${this.key(key)}`;
  }
}

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');

const bodyEmail = (req: Request) =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'none';

function limiter(
  name: string,
  opts: { windowMinutes: number; limit: number; key: (req: Request) => string; message: string },
) {
  const body: ApiErrorBody = { error: { code: 'RATE_LIMITED', message: opts.message } };
  return rateLimit({
    windowMs: opts.windowMinutes * 60_000,
    limit: opts.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: opts.key,
    store: new PostgresStore(name),
    message: body,
    // If Postgres is briefly unavailable, don't block guests at the venue.
    passOnStoreError: true,
  });
}

/*
 * Guests at the venue share one Wi-Fi IP (NAT), so per-IP limits are generous and the
 * tight limits are keyed on the email address or the signed-in guest instead.
 */
export const otpRequestLimits = [
  limiter('otp-req-target', {
    windowMinutes: 10,
    limit: 3,
    key: bodyEmail,
    message: 'Too many codes requested. Please wait a few minutes.',
  }),
  limiter('otp-req-ip', {
    windowMinutes: 10,
    limit: 100,
    key: ipKey,
    message: 'Too many requests from this network. Please wait a few minutes.',
  }),
];

export const otpVerifyLimits = [
  limiter('otp-verify-target', {
    windowMinutes: 10,
    limit: 10,
    key: bodyEmail,
    message: 'Too many attempts. Please wait a few minutes.',
  }),
  limiter('otp-verify-ip', {
    windowMinutes: 10,
    limit: 200,
    key: ipKey,
    message: 'Too many requests from this network. Please wait a few minutes.',
  }),
];

const bodyName = (req: Request) =>
  typeof req.body?.name === 'string' ? req.body.name.trim().toLowerCase().replace(/\s+/g, ' ') : 'none';

/*
 * Codes are 8 characters from a 31-symbol alphabet (~8.5 × 10^11 combinations) and must also
 * match the name, so these limits make guessing hopeless while leaving room for typos.
 */
export const accessCodeLoginLimits = [
  limiter('code-login-name', {
    windowMinutes: 10,
    limit: 10,
    key: bodyName,
    message: 'Too many attempts. Please wait a few minutes and check your invitation.',
  }),
  limiter('code-login-ip', {
    windowMinutes: 10,
    limit: 150,
    key: ipKey,
    message: 'Too many requests from this network. Please wait a few minutes.',
  }),
];

export const likeLimit = limiter('like', {
  windowMinutes: 10,
  limit: 300,
  key: (req) => req.guest?.id ?? ipKey(req),
  message: 'Slow down a little. Try again in a few minutes.',
});

export const commentLimit = limiter('comment', {
  windowMinutes: 10,
  limit: 30,
  key: (req) => req.guest?.id ?? ipKey(req),
  message: "You're commenting very quickly. Try again in a few minutes.",
});

export const familyCodeLimit = limiter('family-code', {
  windowMinutes: 10,
  limit: 10,
  key: (req) => req.guest?.id ?? ipKey(req),
  message: 'Too many attempts. Please wait a few minutes.',
});

// Admins aren't behind venue NAT, so their login limits are per IP as specified.
export const adminLoginLimit = limiter('admin-login', {
  windowMinutes: 15,
  limit: 5,
  key: ipKey,
  message: 'Too many sign-in attempts. Try again in 15 minutes.',
});

export const admin2faLimit = limiter('admin-2fa', {
  windowMinutes: 15,
  limit: 10,
  key: ipKey,
  message: 'Too many attempts. Try again in 15 minutes.',
});

export const uploadInitLimit = limiter('upload-init', {
  windowMinutes: 60,
  limit: 200,
  key: (req) => req.guest?.id ?? ipKey(req),
  message: 'Upload limit reached. Please try again in a while.',
});
