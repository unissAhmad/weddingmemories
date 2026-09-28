/** Pure helpers for laying out files inside a ZIP; kept separate so they're easy to test. */

export interface ZipSource {
  id: string;
  /** Cloudinary public_id of the original */
  publicId: string;
  /** Original file format (jpg, heic, …) used as the file extension */
  format: string | null;
  sizeBytes: number;
  takenAt: Date | null;
  createdAt: Date;
  guest: { id: string; name: string };
}

export interface ZipEntry {
  publicId: string;
  format: string;
  name: string;
  date: Date;
  size: number;
}

/** Windows, macOS and most unzip tools accept this subset of characters in paths. */
export function sanitizeName(name: string) {
  const cleaned = name
    .normalize('NFC')
    // Control characters are deliberately stripped: they're invalid in file names.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return cleaned.slice(0, 80) || 'Guest';
}

const pad = (n: number) => String(n).padStart(2, '0');

function stamp(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}_${pad(
    d.getUTCHours(),
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

/**
 * `Guest Name/2026-12-12_163015_ab12cd34.jpg`. Two different guests with the same name get
 * separate folders ("Sara", "Sara (2)") so their photos don't mix.
 */
export function buildEntries(photos: ZipSource[]): ZipEntry[] {
  const folders = new Map<string, string>();
  const used = new Map<string, number>();

  return photos.map((p) => {
    let folder = folders.get(p.guest.id);
    if (!folder) {
      const base = sanitizeName(p.guest.name);
      const n = (used.get(base.toLowerCase()) ?? 0) + 1;
      used.set(base.toLowerCase(), n);
      folder = n === 1 ? base : `${base} (${n})`;
      folders.set(p.guest.id, folder);
    }
    const date = p.takenAt ?? p.createdAt;
    const ext = (p.format ?? 'jpg').toLowerCase();
    return {
      publicId: p.publicId,
      format: ext,
      name: `${folder}/${stamp(date)}_${p.id.replace(/-/g, '').slice(0, 8)}.${ext}`,
      date,
      size: p.sizeBytes,
    };
  });
}

/** Greedy split so each ZIP part stays under `maxBytes` (a single huge file gets its own part). */
export function splitIntoParts<T extends { size: number }>(entries: T[], maxBytes: number): T[][] {
  const parts: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const e of entries) {
    if (current.length > 0 && bytes + e.size > maxBytes) {
      parts.push(current);
      current = [];
      bytes = 0;
    }
    current.push(e);
    bytes += e.size;
  }
  if (current.length) parts.push(current);
  return parts;
}
