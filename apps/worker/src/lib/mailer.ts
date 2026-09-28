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
    logger.warn({ to: mail.to, subject: mail.subject, text: mail.text }, 'mail (not sent, no RESEND_API_KEY)');
    return;
  }
  const { error } = await resend.emails.send({ from: env.MAIL_FROM, ...mail });
  if (error) throw new Error(`Mail delivery failed: ${error.message}`);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function zipReadyMail(
  to: string,
  eventName: string,
  parts: { name: string; url: string }[],
  adminUrl: string,
  ttlHours: number,
): Mail {
  const links = parts
    .map(
      (p) =>
        `<li style="margin:0 0 8px"><a href="${p.url}" style="color:#3d352e">${escapeHtml(p.name)}</a></li>`,
    )
    .join('');
  return {
    to,
    subject: `Your photo download for ${eventName} is ready`,
    text: `Your download is ready (${parts.length} file(s)). Links expire in ${ttlHours} hours:\n${parts
      .map((p) => `${p.name}: ${p.url}`)
      .join('\n')}\n\nAdmin panel: ${adminUrl}`,
    html: `
<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;color:#3b3632">
  <p style="font-size:14px;letter-spacing:.2em;text-transform:uppercase;color:#8a7f74;margin:0 0 8px">${escapeHtml(eventName)}</p>
  <h1 style="font-weight:400;font-size:24px;margin:0 0 24px">Your download is ready</h1>
  <ul style="font-family:Arial,sans-serif;font-size:15px;padding-left:18px;margin:0 0 24px">${links}</ul>
  <p style="font-family:Arial,sans-serif;font-size:14px;color:#8a7f74;margin:0">
    These links expire in ${ttlHours} hours. You can always start a new download from the
    <a href="${adminUrl}" style="color:#8a7f74">admin panel</a>.
  </p>
</div>`,
  };
}
