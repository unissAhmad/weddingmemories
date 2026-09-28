/**
 * Load test: N guests uploading M photos each, all at once, through the real flow
 * (init → signed upload straight to Cloudinary → complete), then waits for the worker.
 *
 * Every upload is a real Cloudinary upload and counts towards your plan's credits.
 *
 *   pnpm --filter @wm/api loadtest -- --api https://api.staging.example.com --users 100 --photos 3
 *
 * Guest sessions are minted directly (needs DATABASE_URL + JWT_SECRET_GUEST for the target),
 * so no emails are sent. Run against staging, not production. Test guests are blocked and
 * their photos queued for purge at the end.
 */
import { createHash, randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { CSRF_HEADER, type UploadInitResponse } from '@wm/shared';
import { prisma } from '@wm/db';
import { signGuestToken } from '../src/lib/jwt';

const { values: args } = parseArgs({
  options: {
    api: { type: 'string', default: 'http://localhost:4000' },
    origin: { type: 'string', default: process.env.WEB_ORIGIN?.split(',')[0] ?? 'http://localhost:5173' },
    slug: { type: 'string', default: 'demo-wedding' },
    users: { type: 'string', default: '100' },
    photos: { type: 'string', default: '3' },
    mb: { type: 'string', default: '3' },
    'keep-data': { type: 'boolean', default: false },
  },
});

const USERS = Number(args.users);
const PHOTOS = Number(args.photos);
const API = `${args.api!.replace(/\/$/, '')}/api`;

/** One noisy JPEG of roughly `mb` MB; unique copies are made by appending bytes after EOI. */
async function baseJpeg(mb: number) {
  const side = Math.round(Math.sqrt((mb * 1024 * 1024) / 1.6));
  return sharp(randomBytes(side * side * 3), { raw: { width: side, height: side, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
}
const uniqueCopy = (base: Buffer) => Buffer.concat([base, randomBytes(16)]);

async function call<T>(token: string, path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: {
      Cookie: `wm_guest=${token}`,
      Origin: args.origin!,
      ...(method !== 'GET' && { [CSRF_HEADER]: '1' }),
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

async function uploadOne(token: string, file: Buffer, n: number) {
  const sha256 = createHash('sha256').update(file).digest('hex');
  const init = await call<UploadInitResponse>(token, '/photos/uploads', 'POST', {
    filename: `LOAD_${n}.jpg`,
    mimeType: 'image/jpeg',
    size: file.length,
    sha256,
  });
  const form = new FormData();
  for (const [k, v] of Object.entries(init.params)) form.append(k, v);
  form.append('file', new Blob([new Uint8Array(file)], { type: 'image/jpeg' }), `LOAD_${n}.jpg`);
  const up = await fetch(init.uploadUrl, { method: 'POST', body: form });
  if (!up.ok) throw new Error(`cloudinary upload → ${up.status} ${await up.text()}`);
  await call(token, `/photos/${init.photoId}/complete`, 'POST', await up.json());
  return init.photoId;
}

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

async function main() {
  const event = await prisma.event.findUnique({ where: { slug: args.slug! } });
  if (!event) throw new Error(`No event with slug ${args.slug}`);

  console.log(`Preparing ${USERS} guests × ${PHOTOS} photos (~${args.mb} MB each) against ${API}`);
  const base = await baseJpeg(Number(args.mb));
  const guests = await Promise.all(
    Array.from({ length: USERS }, async (_, i) => {
      const contact = `loadtest+${i}-${Date.now()}@example.invalid`;
      const g = await prisma.guest.create({
        data: { eventId: event.id, name: `Load test ${i}`, contact, verifiedAt: new Date() },
      });
      return { id: g.id, token: await signGuestToken({ guestId: g.id, eventId: event.id }) };
    }),
  );

  const durations: number[] = [];
  const errors: string[] = [];
  const photoIds: string[] = [];
  const started = Date.now();

  await Promise.all(
    guests.map(async (g, gi) => {
      // Each guest uploads their photos one after another, like Uppy with a slow link.
      for (let p = 0; p < PHOTOS; p++) {
        const t0 = Date.now();
        try {
          photoIds.push(await uploadOne(g.token, uniqueCopy(base), gi * PHOTOS + p));
          durations.push(Date.now() - t0);
        } catch (err) {
          errors.push((err as Error).message.slice(0, 200));
        }
      }
    }),
  );
  const uploadSecs = (Date.now() - started) / 1000;

  console.log(`\nUploads finished in ${uploadSecs.toFixed(1)}s. Waiting for the worker…`);
  let pending = photoIds.length;
  const waitStart = Date.now();
  while (pending > 0 && Date.now() - waitStart < 30 * 60_000) {
    pending = await prisma.photo.count({ where: { id: { in: photoIds }, status: 'PROCESSING' } });
    process.stdout.write(`\r  still processing: ${pending}   `);
    if (pending > 0) await new Promise((r) => setTimeout(r, 2000));
  }
  const processSecs = (Date.now() - started) / 1000;
  const byStatus = await prisma.photo.groupBy({ by: ['status'], where: { id: { in: photoIds } }, _count: true });

  const sorted = [...durations].sort((a, b) => a - b);
  const mbTotal = (base.length * photoIds.length) / 1024 / 1024;
  console.log('\n\n── Results ─────────────────────────────');
  console.log(`uploads ok        ${photoIds.length}/${USERS * PHOTOS}  (errors: ${errors.length})`);
  console.log(`upload time       p50 ${pct(sorted, 0.5)} ms · p95 ${pct(sorted, 0.95)} ms · max ${sorted.at(-1) ?? 0} ms`);
  console.log(`throughput        ${(mbTotal / uploadSecs).toFixed(1)} MB/s over ${uploadSecs.toFixed(1)} s`);
  console.log(`all processed in  ${processSecs.toFixed(1)} s`);
  console.log(`final statuses    ${byStatus.map((s) => `${s.status}=${s._count}`).join(' ')}`);
  if (errors.length) console.log(`first errors:\n  ${[...new Set(errors)].slice(0, 5).join('\n  ')}`);

  if (!args['keep-data']) {
    // Hand the test photos to the cleanup job (deletes them from Cloudinary within ~15 min).
    await prisma.photo.updateMany({
      where: { id: { in: photoIds } },
      data: { status: 'DELETED', sha256: null, deletedAt: new Date(0) },
    });
    await prisma.guest.updateMany({ where: { id: { in: guests.map((g) => g.id) } }, data: { blocked: true } });
    console.log('\nTest photos queued for purge; test guests blocked.');
  }
  await prisma.$disconnect();
  process.exitCode = errors.length ? 1 : 0;
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
