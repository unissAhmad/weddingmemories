import type { GuestMe, OtpVerify } from '@wm/shared';
import { prisma } from '../lib/prisma';
import { AppError, notFound } from '../lib/errors';
import { signGuestToken } from '../lib/jwt';
import { consumeOtp } from './otp.service';

/** Verifies the OTP, creates or updates the guest, and returns a session token. */
export async function verifyGuest(input: OtpVerify) {
  const event = await consumeOtp(input);

  const guest = await prisma.guest.upsert({
    where: { eventId_contact: { eventId: event.id, contact: input.email } },
    create: {
      eventId: event.id,
      name: input.name,
      contact: input.email,
      contactType: 'EMAIL',
      verifiedAt: new Date(),
    },
    update: { name: input.name, verifiedAt: new Date() },
  });

  if (guest.blocked) {
    throw new AppError(403, 'GUEST_BLOCKED', 'Your access to this event has been removed.');
  }

  const token = await signGuestToken({ guestId: guest.id, eventId: event.id });
  return { token, me: await getGuestMe(guest.id, event.id) };
}

export async function getGuestMe(guestId: string, eventId: string): Promise<GuestMe> {
  const guest = await prisma.guest.findFirst({
    where: { id: guestId, eventId },
    include: { event: { select: { id: true, slug: true } }, access: { select: { status: true } } },
  });
  if (!guest) throw notFound('Guest');

  return {
    guest: { id: guest.id, name: guest.name, contact: guest.contact },
    event: guest.event,
    access: guest.access?.status ?? null,
  };
}
