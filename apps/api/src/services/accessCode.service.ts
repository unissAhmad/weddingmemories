import { createHmac, randomInt } from 'node:crypto';
import {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
  formatAccessCode,
  normalizeGuestName,
  type AccessCodeLogin,
  type CodeGuest,
} from '@wm/shared';
import { Prisma, prisma } from '../lib/prisma';
import { AppError, notFound } from '../lib/errors';
import { decrypt, encrypt } from '../lib/secrets';
import { signGuestToken } from '../lib/jwt';
import { audit } from '../lib/audit';
import { env } from '../env';
import type { AdminCtx } from '../middleware/requireAdmin';
import { getEventBySlug } from './events.service';
import { getGuestMe } from './guest.service';

export function generateAccessCode() {
  let code = '';
  for (let i = 0; i < ACCESS_CODE_LENGTH; i++) {
    code += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  }
  return code;
}

/** Deterministic, so a typed code can be looked up; keyed, so a DB leak doesn't reveal codes. */
export function accessCodeLookup(eventId: string, normalizedCode: string) {
  return createHmac('sha256', env.OTP_SECRET).update(`access-code:${eventId}:${normalizedCode}`).digest('hex');
}

export function revealAccessCode(enc: string | null) {
  if (!enc) return null;
  try {
    return formatAccessCode(decrypt(enc));
  } catch {
    return null;
  }
}

const mismatch = () =>
  new AppError(400, 'ACCESS_CODE_INVALID', "That name and access code don't match. Check the spelling on your invitation.");

/** Guest sign-in without email: the code must exist and the name must match its guest. */
export async function signInWithAccessCode(input: AccessCodeLogin) {
  const event = await getEventBySlug(input.slug);
  const guest = await prisma.guest.findUnique({
    where: { eventId_accessCodeLookup: { eventId: event.id, accessCodeLookup: accessCodeLookup(event.id, input.code) } },
  });
  // Same error for an unknown code and a wrong name, so neither can be probed separately.
  if (!guest || normalizeGuestName(guest.name) !== normalizeGuestName(input.name)) throw mismatch();
  if (guest.blocked) {
    throw new AppError(403, 'GUEST_BLOCKED', 'Your access to this event has been removed.');
  }

  if (!guest.verifiedAt) {
    await prisma.guest.update({ where: { id: guest.id }, data: { verifiedAt: new Date() } });
  }
  const token = await signGuestToken({ guestId: guest.id, eventId: event.id });
  return { token, me: await getGuestMe(guest.id, event.id) };
}

const isCodeCollision = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  err.code === 'P2002' &&
  String(err.meta?.target ?? '').includes('accessCodeLookup');

/** Admin: create invited guests. Each gets a personal code and gallery access straight away. */
export async function createCodeGuests(admin: AdminCtx, eventId: string, names: string[]): Promise<CodeGuest[]> {
  const created: CodeGuest[] = [];
  for (const name of names) {
    for (let attempt = 1; ; attempt++) {
      const code = generateAccessCode();
      try {
        const guest = await prisma.guest.create({
          data: {
            eventId,
            name,
            contactType: 'ACCESS_CODE',
            accessCodeLookup: accessCodeLookup(eventId, code),
            accessCodeEnc: encrypt(code),
            access: { create: { status: 'APPROVED', decidedBy: admin.id, decidedAt: new Date() } },
          },
        });
        created.push({ id: guest.id, name: guest.name, code: formatAccessCode(code) });
        break;
      } catch (err) {
        // ~1 in 850 billion per pair; retry just in case.
        if (!isCodeCollision(err) || attempt >= 5) throw err;
      }
    }
  }
  await audit({
    adminId: admin.id,
    eventId,
    action: 'guest.create_with_code',
    meta: { count: created.length, guestIds: created.map((g) => g.id) },
  });
  return created;
}

/** Admin: issue a new code (the old one stops working immediately). */
export async function resetAccessCode(admin: AdminCtx, eventId: string, guestId: string): Promise<CodeGuest> {
  const guest = await prisma.guest.findFirst({ where: { id: guestId, eventId } });
  if (!guest) throw notFound('Guest');

  for (let attempt = 1; ; attempt++) {
    const code = generateAccessCode();
    try {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { accessCodeLookup: accessCodeLookup(eventId, code), accessCodeEnc: encrypt(code) },
      });
      await audit({ adminId: admin.id, eventId, action: 'guest.reset_code', targetId: guest.id });
      return { id: guest.id, name: guest.name, code: formatAccessCode(code) };
    } catch (err) {
      if (!isCodeCollision(err) || attempt >= 5) throw err;
    }
  }
}
