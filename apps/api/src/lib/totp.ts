import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// Accept the previous and next 30-second step to tolerate phone clock drift.
authenticator.options = { window: 1 };

const ISSUER = 'Wedding Memories';

export const generateTotpSecret = () => authenticator.generateSecret();

export function verifyTotp(code: string, secret: string) {
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}

export async function totpSetupPayload(email: string, secret: string) {
  const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
  return { otpauthUrl, qrDataUrl, secret };
}
