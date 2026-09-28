import argon2 from 'argon2';
import type { AdminLoginResult, AdminMe } from '@wm/shared';
import { prisma } from '../../lib/prisma';
import { AppError, unauthorized } from '../../lib/errors';
import { decrypt, encrypt } from '../../lib/secrets';
import { generateTotpSecret, totpSetupPayload, verifyTotp } from '../../lib/totp';
import { audit } from '../../lib/audit';

// Verified against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = argon2.hash('not-a-real-password-used-for-timing');

const badCredentials = () => new AppError(401, 'UNAUTHORIZED', 'Email or password is incorrect.');

/** Step 1: password. Returns what the second step needs and the admin id for the pre-auth token. */
export async function login(email: string, password: string) {
  const admin = await prisma.admin.findUnique({ where: { email } });
  const ok = await argon2.verify(admin?.passwordHash ?? (await DUMMY_HASH), password).catch(() => false);
  if (!admin || !ok) throw badCredentials();

  if (admin.totpEnabledAt && admin.totpSecret) {
    return { adminId: admin.id, result: { next: '2fa' } satisfies AdminLoginResult };
  }

  // First sign-in (or 2FA was reset): issue a secret to enrol. It's only
  // activated once the admin proves they can generate a valid code.
  const secret = admin.totpSecret ? decrypt(admin.totpSecret) : generateTotpSecret();
  if (!admin.totpSecret) {
    await prisma.admin.update({ where: { id: admin.id }, data: { totpSecret: encrypt(secret) } });
  }
  const setup = await totpSetupPayload(admin.email, secret);
  return { adminId: admin.id, result: { next: 'setup', ...setup } satisfies AdminLoginResult };
}

/** Step 2: TOTP code. Also completes enrolment on first sign-in. */
export async function verifySecondFactor(adminId: string, code: string): Promise<AdminMe> {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin?.totpSecret) throw unauthorized('Please sign in again');

  if (!verifyTotp(code, decrypt(admin.totpSecret))) {
    throw new AppError(401, 'TOTP_INVALID', "That code didn't match. Check your authenticator app.");
  }

  const enrolling = !admin.totpEnabledAt;
  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date(), ...(enrolling ? { totpEnabledAt: new Date() } : {}) },
  });
  await audit({ adminId: admin.id, action: enrolling ? 'admin.2fa_enrolled' : 'admin.login' });

  return { id: admin.id, email: admin.email, role: admin.role };
}
