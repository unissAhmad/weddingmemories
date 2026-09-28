import { Resend } from 'resend';
import { env } from '../env';
import { logger } from './logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(mail: Mail) {
  if (!resend) {
    // Local development without Resend: print the mail so OTP codes are visible.
    logger.warn({ to: mail.to, subject: mail.subject, text: mail.text }, 'mail (not sent, no RESEND_API_KEY)');
    return;
  }
  const { error } = await resend.emails.send({ from: env.MAIL_FROM, ...mail });
  if (error) {
    logger.error({ err: error, to: mail.to }, 'failed to send mail');
    throw new Error(`Mail delivery failed: ${error.message}`);
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(eventName: string, heading: string, body: string) {
  return `
<div style="font-family:Georgia,serif;max-width:440px;margin:0 auto;padding:32px;color:#3b3632">
  <p style="font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#8a7f74;margin:0 0 8px">${escapeHtml(eventName)}</p>
  <h1 style="font-weight:400;font-size:24px;margin:0 0 24px">${heading}</h1>
  ${body}
</div>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:0 0 24px"><a href="${href}" style="display:inline-block;background:#3d352e;color:#faf7f2;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;padding:12px 24px;border-radius:999px">${label}</a></p>`;

const small = (text: string) =>
  `<p style="font-family:Arial,sans-serif;font-size:14px;color:#8a7f74;margin:0">${text}</p>`;

export function accessApprovedMail(to: string, guestName: string, eventName: string, galleryUrl: string): Mail {
  return {
    to,
    subject: `You can now see every photo from ${eventName}`,
    text: `Hi ${guestName}, your access to the ${eventName} gallery has been approved: ${galleryUrl}`,
    html: layout(
      eventName,
      `The gallery is open to you, ${escapeHtml(guestName)}`,
      button(galleryUrl, 'View the gallery') +
        small('Thank you for sharing the day with us.'),
    ),
  };
}

export function otpMail(to: string, code: string, eventName: string, ttlMinutes: number): Mail {
  const name = escapeHtml(eventName);
  return {
    to,
    subject: `${code} is your code for ${eventName}`,
    text: `Your code for ${eventName} is ${code}. It expires in ${ttlMinutes} minutes.`,
    html: `
<div style="font-family:Georgia,serif;max-width:420px;margin:0 auto;padding:32px;color:#3b3632">
  <p style="font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#8a7f74;margin:0 0 8px">${name}</p>
  <h1 style="font-weight:400;font-size:24px;margin:0 0 24px">Your sign-in code</h1>
  <p style="font-family:ui-monospace,monospace;font-size:36px;letter-spacing:.3em;margin:0 0 24px">${code}</p>
  <p style="font-family:Arial,sans-serif;font-size:14px;color:#8a7f74;margin:0">
    This code expires in ${ttlMinutes} minutes. If you didn't request it, you can ignore this email.
  </p>
</div>`,
  };
}
