import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  type OtpRequest,
  type OtpVerify,
} from '@wm/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { otpMail, sendMail } from '../lib/mailer';
import { env } from '../env';
import { getEventBySlug } from './events.service';

export function generateCode() {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

/** Codes are stored as an HMAC bound to the event and target, never in plain text. */
export function hashCode(eventId: string, target: string, code: string) {
  return createHmac('sha256', env.OTP_SECRET).update(`${eventId}:${target}:${code}`).digest('hex');
}

function hashesMatch(a: string, b: string) {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function requestOtp(input: OtpRequest) {
  const event = await getEventBySlug(input.slug);
  const code = generateCode();

  await prisma.otpCode.create({
    data: {
      eventId: event.id,
      target: input.email,
      codeHash: hashCode(event.id, input.email, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
    },
  });

  await sendMail(otpMail(input.email, code, event.name, OTP_TTL_MINUTES));
}

/** Checks the most recent unused code for this target. Returns the event on success. */
export async function consumeOtp(input: OtpVerify) {
  const event = await getEventBySlug(input.slug);

  const otp = await prisma.otpCode.findFirst({
    where: { eventId: event.id, target: input.email, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) throw new AppError(400, 'OTP_INVALID', 'That code is not valid. Request a new one.');
  if (otp.expiresAt < new Date()) {
    throw new AppError(400, 'OTP_EXPIRED', 'That code has expired. Request a new one.');
  }

  // Count the attempt atomically before comparing so parallel guesses can't exceed the cap.
  const counted = await prisma.otpCode.updateMany({
    where: { id: otp.id, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) {
    throw new AppError(429, 'OTP_TOO_MANY_ATTEMPTS', 'Too many wrong attempts. Request a new code.');
  }

  if (!hashesMatch(otp.codeHash, hashCode(event.id, input.email, input.code))) {
    const left = OTP_MAX_ATTEMPTS - otp.attempts - 1;
    throw new AppError(400, 'OTP_INVALID', 'That code is not right.', { attemptsLeft: left });
  }

  const consumed = await prisma.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) {
    throw new AppError(400, 'OTP_INVALID', 'That code has already been used.');
  }

  return event;
}
