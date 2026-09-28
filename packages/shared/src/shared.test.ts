import { describe, expect, it } from 'vitest';
import { parseEventSettings } from './event';
import { OtpVerifySchema } from './guest';
import { AdminLoginSchema } from './admin';
import { publicIds, UploadCompleteSchema } from './photos';
import {
  AccessCodeLoginSchema,
  formatAccessCode,
  normalizeAccessCode,
  normalizeGuestName,
} from './accessCode';

describe('Cloudinary ids and upload results', () => {
  it('builds public ids under the environment folder', () => {
    expect(publicIds.original('wm-dev', 'evt1', 'p1')).toBe('wm-dev/events/evt1/originals/p1');
  });

  it('accepts Cloudinary upload responses with numeric versions', () => {
    const parsed = UploadCompleteSchema.parse({
      public_id: 'wm-dev/events/evt1/originals/p1',
      version: 1727600000,
      signature: 'abcdef0123456789abcdef0123456789abcdef01',
      format: 'heic',
      bytes: 2048,
    });
    expect(parsed.version).toBe('1727600000');
  });
});

describe('parseEventSettings', () => {
  it('fills defaults for empty settings', () => {
    expect(parseEventSettings({})).toEqual({
      autoApprove: false,
      moderateBeforePublish: false,
      uploadsOpen: true,
      familyCodeHash: null,
    });
  });

  it('falls back to defaults on garbage', () => {
    expect(parseEventSettings('nope').uploadsOpen).toBe(true);
  });
});

describe('access codes', () => {
  it('normalizes codes typed with dashes, spaces and lowercase', () => {
    expect(normalizeAccessCode(' ab7k-2mq9 ')).toBe('AB7K2MQ9');
    expect(formatAccessCode('ab7k2mq9')).toBe('AB7K-2MQ9');
  });

  it('matches names regardless of case, accents, dots and spacing', () => {
    expect(normalizeGuestName("  José   D'Souza ")).toBe(normalizeGuestName('jose dsouza'));
    expect(normalizeGuestName('Dr. Sara Khan')).toBe(normalizeGuestName('dr sara khan'));
    expect(normalizeGuestName('Sara Khan')).not.toBe(normalizeGuestName('Sara'));
  });

  it('validates the login form', () => {
    const ok = AccessCodeLoginSchema.parse({ slug: 'demo-wedding', name: 'Sara', code: 'ab7k-2mq9' });
    expect(ok.code).toBe('AB7K2MQ9');
    expect(() => AccessCodeLoginSchema.parse({ slug: 'demo-wedding', name: 'Sara', code: 'abc' })).toThrow();
  });
});

describe('AdminLoginSchema', () => {
  it('accepts a username or an email, case-insensitively', () => {
    expect(AdminLoginSchema.parse({ email: ' Uniss ', password: 'x' }).email).toBe('uniss');
    expect(AdminLoginSchema.parse({ email: 'Owner@Example.com', password: 'x' }).email).toBe('owner@example.com');
    expect(() => AdminLoginSchema.parse({ email: 'ab', password: 'x' })).toThrow();
  });
});

describe('OtpVerifySchema', () => {
  it('normalizes the email and name', () => {
    const parsed = OtpVerifySchema.parse({
      slug: 'amir-and-sara',
      name: ' Aisha ',
      email: ' Aisha@Example.com',
      code: '012345',
    });
    expect(parsed.email).toBe('aisha@example.com');
    expect(parsed.name).toBe('Aisha');
  });

  it('rejects short codes', () => {
    expect(() =>
      OtpVerifySchema.parse({ slug: 'x-y', name: 'A', email: 'a@b.co', code: '123' }),
    ).toThrow();
  });
});
