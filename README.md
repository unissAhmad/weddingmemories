# Wedding Memories

Guests scan a QR code, verify with an emailed code, and upload the photos they took. Photos go
straight from the phone to Cloudflare R2 in resumable chunks; a background worker makes web-sized
copies with all location data removed.

```
apps/web      React + Vite: guest app (/e/:slug) and admin panel (/admin), installable PWA
apps/api      Express API: guest + admin auth, presigned uploads, gallery, admin endpoints
apps/worker   pg-boss jobs: photo.process, zip.build, maintenance.cleanup (every 15 min)
packages/db   Prisma schema, migrations, seed
packages/shared  zod schemas + types used by all three apps
```

## Status

All five build phases are implemented. The only items left are the ones that need real
hardware and real people: testing on real iPhone and Android devices over throttled 3G, and a
dry run with the client.

| Area | What's there |
|---|---|
| Guests | Email code sign-in, resumable uploads, My uploads, gallery with masonry + lightbox + highlights |
| Access | Two ways in: **personal access code** (name + code from the invitation, no email, gallery open at once) or **email** → request → admin approval; plus auto-approve and a shared family code |
| Admin | Password + TOTP 2FA, access queue, photo moderation, guests, settings, cover, QR, ZIP downloads, audit log, team |
| Jobs | Photo processing, streamed ZIPs split at ~2 GB, cleanup (purges deleted photos after 7 days, aborts stale uploads, requeues stuck photos, expires ZIPs) |

## Local development

Requirements: Node 20.19+ and pnpm 10 (`npm i -g pnpm@10`), a Postgres database, and an R2
bucket for development.

You don't need Postgres on your machine: a free Neon database, or a second Render database used only
for development, works fine.

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL, R2_*, secrets, SEED_ADMIN_PASSWORD
pnpm db:migrate               # applies migrations
pnpm db:seed                  # owner admin + demo event at /e/demo-wedding
pnpm dev                      # web :5173, api :4000, worker
```

Without `RESEND_API_KEY`, sign-in codes are printed in the API log instead of being emailed.

**No R2 account yet?** Set `R2_ENDPOINT=http://127.0.0.1:4569`, `R2_ACCESS_KEY_ID=S3RVER`,
`R2_SECRET_ACCESS_KEY=S3RVER`, then run `pnpm dev:local`. It starts a local S3-compatible storage
server (files in `.dev-storage/`) alongside web, API and worker. The one thing it can't do is
resume an interrupted upload after a reload; that needs real R2.

The admin panel lives at `/admin`. Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; the
first sign-in shows a QR code to set up an authenticator app (Google Authenticator, 1Password…).
If an admin loses their phone, an owner can reset their 2FA under **Team**.

| Role | Can |
|---|---|
| Owner | Everything, on every event |
| Moderator | Access queue, photos, guests, for the events they're assigned to |

Other commands: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm db:studio`.

## Deploying on Render

The database is Neon: set `DATABASE_URL` to the pooled URL and `DIRECT_URL` to the same URL
without `-pooler`. Postgres also holds the job queue and rate limits, so there is no Redis.
There are two Blueprints (**New → Blueprint → select this repo**):

| File | Cost | Services | Use for |
|---|---|---|---|
| `render.yaml` (default) | Free, no card | `wm-app`: one free web service running API **and** worker (`tools/start-all.mjs`); website on Netlify | Testing |
| `render.production.yaml` | ~$14/month | `wm-api` + `wm-worker` (Starter, always on), `wm-web` static site | The wedding |

**Free-plan limits:** the service sleeps after 15 minutes without traffic, and the first visit
after that waits about 50 seconds for it to wake up. Photo processing pauses while it sleeps,
and 512 MB of memory is shared by the API and the photo processing. Switch to the production
Blueprint (in the Blueprint form, set the path to `render.production.yaml`) about a week before
the event.

Both run migrations during the build and use `/api/health` as the health check. Each app's
`.env.example` lists what a service needs if you create services by hand.

### Domain (important)

Put the web app and API under **one domain you own**, for example:

- `photos.example.com` → `wm-web`
- `api.photos.example.com` → `wm-api`

Then set `WEB_ORIGIN=https://photos.example.com` on the API and
`VITE_API_URL=https://api.photos.example.com` on the web app. Safari blocks the session cookie if
the two live on different sites such as `onrender.com` subdomains.

### Alternative: web app on Netlify

Netlify can host the web app (not the API or worker, which need long-running processes).
`netlify.toml` builds `apps/web` and **proxies `/api/*` to the Render API**, so the browser sees
one site and cookies work in Safari even without a custom domain.

1. Deploy `wm-api` and `wm-worker` on Render as above (skip or delete `wm-web`).
2. In `netlify.toml`, set the proxy target to your API URL (e.g. `https://wm-api.onrender.com`).
3. Netlify → **Add new site → Import from Git** → pick the repo (settings come from `netlify.toml`).
4. On `wm-api` set `WEB_ORIGIN` and `PUBLIC_WEB_URL` to the Netlify URL (e.g.
   `https://aisha-omar.netlify.app`) and `TRUST_PROXY=2` (Netlify + Render proxies).
5. Add your Netlify URL to the R2 bucket's CORS `AllowedOrigins`.

### Cloudflare R2

1. Create a bucket and keep it **private** (no public access or r2.dev URL).
2. Create an API token with *Object Read & Write* on that bucket only. That gives you
   `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. `R2_ACCOUNT_ID` is shown on the R2 overview page.
3. Bucket **Settings → CORS policy**:

   ```json
   [
     {
       "AllowedOrigins": ["https://photos.example.com", "http://localhost:5173"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   `ExposeHeaders: ETag` is required: without it, multipart uploads cannot complete.
4. **Settings → Object lifecycle rules**: add a rule that aborts incomplete multipart uploads
   after 1 day.

### Resend

Verify your sending domain, then set `RESEND_API_KEY` and `MAIL_FROM` (an address on that domain).

## Access codes

In **Guests → Add guests with codes**, paste names one per line. Each guest gets a personal
8-character code (e.g. `Q9TV-QQXS`, no look-alike characters) that you can copy or download as
CSV to print on invitations. On the join page the guest chooses **I have an access code** and
enters their name and code. Both must match. Capitals, accents, dots and extra spaces don't
matter, but "Zara" won't match "Zara Khan".

Code guests skip email entirely and can see the gallery straight away. You can still revoke
their access, block them, or issue a new code (the old one stops working). Codes are stored
encrypted, with only a keyed hash used for lookup, and sign-in attempts are limited to 10 per
name per 10 minutes.

## Load test

`apps/api/scripts/loadtest.ts` simulates many guests uploading at once through the real
multipart flow, then waits for the worker. It creates guest sessions directly (no emails), so
it needs the **target's** `DATABASE_URL` and `JWT_SECRET_GUEST` in `.env`. Run it against
staging, never production:

```bash
pnpm --filter @wm/api loadtest -- --api https://api.staging.example.com --users 100 --photos 3 --mb 4
```

Afterwards the test guests are blocked and their photos are handed to the cleanup job.

Local result (100 guests × 2 photos, 2 MB each, local S3 emulator): 200/200 uploads, 0 errors,
p95 upload 7 s. The worker is the bottleneck, at about 1 photo per second at `WORKER_CONCURRENCY=2`.
Uploads are never blocked by processing; photos simply appear in the gallery a little later.

## Wedding-day runbook

- **The day before:** make sure uploads are open, turn on *Review photos before publishing* if
  the couple wants to see everything first, set the family code, and print the QR from
  **Overview**. Then sign in as a guest on a phone and upload a test photo.
- **During the event:** keep **Access** open on one phone to approve guests. Most guests only
  need to upload, which never needs approval.
- **After the event:** turn off *Uploads open*. Then, under **Downloads → Download all photos**,
  the links arrive by email and expire after 24 hours; you can start a new download any time.

## How an upload works

1. The browser hashes the file (SHA-256) and calls `POST /api/photos/uploads`. A duplicate is
   rejected here, before any bytes are sent.
2. The API creates the `Photo` row (status `UPLOADING`) and an R2 multipart upload.
3. Uppy uploads 5 MB parts straight to R2 using presigned URLs, retrying each part with back-off.
   The queue is saved in IndexedDB, so a reload or a locked phone resumes where it left off.
4. `POST /api/photos/:id/complete` checks the final size, sets status `PROCESSING`, and queues
   `photo.process`.
5. The worker converts HEIC, applies EXIF rotation, writes a 1600px and a 400px WebP with **no
   metadata** (GPS is removed), computes the blurhash, and marks the photo `READY` (or `HIDDEN` when
   moderation is on). The original is never modified.

## Security notes

- Guest sessions: an httpOnly `SameSite=Lax` cookie containing a 30-day JWT. The guest is reloaded
  on every request, so blocking takes effect immediately.
- CSRF: every mutating request must send the `x-wm-csrf` header. Browsers can't add it cross-site
  without a CORS preflight, and CORS allows only `WEB_ORIGIN`.
- Sign-in codes are stored as an HMAC, expire after 10 minutes, allow 5 attempts, and can be used
  only once.
- Rate limits are keyed per email or guest. The per-IP limits are deliberately generous because
  the whole venue shares one Wi-Fi IP.
- The API never returns URLs for originals. Only thumbnail and display derivatives get signed URLs,
  valid for 1–1.5 hours.
- Admins: argon2 passwords, TOTP secrets encrypted at rest (AES-GCM), separate `SameSite=Strict`
  cookies scoped to `/api/admin` that last 8 hours, and a login limit of 5 attempts per 15 minutes
  per IP.
- The family code is stored as a scrypt hash and never written to the audit log. When an admin
  revokes a guest's access, the family code can't re-grant it.
