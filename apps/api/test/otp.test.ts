import { describe, expect, it } from 'vitest';
import { OTP_LENGTH } from '@wm/shared';
import { generateCode, hashCode } from '../src/services/otp.service';
import { signGuestToken, verifyGuestToken } from '../src/lib/jwt';

describe('otp', () => {
  it('generates zero-padded numeric codes', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));
    }
  });

  it('binds the hash to event and target', () => {
    const a = hashCode('evt1', 'a@b.co', '123456');
    expect(a).toBe(hashCode('evt1', 'a@b.co', '123456'));
    expect(a).not.toBe(hashCode('evt2', 'a@b.co', '123456'));
    expect(a).not.toBe(hashCode('evt1', 'c@b.co', '123456'));
    expect(a).not.toContain('123456');
  });
});

describe('guest jwt', () => {
  it('round-trips claims', async () => {
    const token = await signGuestToken({ guestId: 'g1', eventId: 'e1' });
    expect(await verifyGuestToken(token)).toEqual({ guestId: 'g1', eventId: 'e1' });
  });

  it('rejects tampered tokens', async () => {
    const token = await signGuestToken({ guestId: 'g1', eventId: 'e1' });
    expect(await verifyGuestToken(`${token}x`)).toBeNull();
  });
});
