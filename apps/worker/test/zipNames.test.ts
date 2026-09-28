import { describe, expect, it } from 'vitest';
import { buildEntries, sanitizeName, splitIntoParts, type ZipSource } from '../src/jobs/zipNames';

const photo = (id: string, guestId: string, guestName: string, size = 1): ZipSource => ({
  id,
  originalKey: `events/e/originals/${id}.heic`,
  sizeBytes: size,
  takenAt: new Date('2026-12-12T16:30:15Z'),
  createdAt: new Date('2026-12-12T18:00:00Z'),
  guest: { id: guestId, name: guestName },
});

describe('sanitizeName', () => {
  it('strips characters that break file systems', () => {
    expect(sanitizeName('  Aunt "Zara" / <Mum>?  ')).toBe('Aunt Zara Mum');
    expect(sanitizeName('...')).toBe('Guest');
    expect(sanitizeName('Rahul.')).toBe('Rahul');
  });
});

describe('buildEntries', () => {
  it('names files by guest folder and time taken', () => {
    const [entry] = buildEntries([photo('abcd1234-ffff', 'g1', 'Sara Khan')]);
    expect(entry!.name).toBe('Sara Khan/2026-12-12_163015_abcd1234.heic');
  });

  it('keeps guests with the same name in separate folders', () => {
    const names = buildEntries([
      photo('a1', 'g1', 'Sara'),
      photo('a2', 'g2', 'sara'),
      photo('a3', 'g1', 'Sara'),
    ]).map((e) => e.name.split('/')[0]);
    expect(names).toEqual(['Sara', 'sara (2)', 'Sara']);
  });
});

describe('splitIntoParts', () => {
  it('splits by cumulative size', () => {
    const parts = splitIntoParts([{ size: 4 }, { size: 4 }, { size: 4 }, { size: 1 }], 8);
    expect(parts.map((p) => p.length)).toEqual([2, 2]);
  });

  it('puts an oversized file in its own part', () => {
    const parts = splitIntoParts([{ size: 1 }, { size: 20 }, { size: 1 }], 8);
    expect(parts.map((p) => p.map((e) => e.size))).toEqual([[1], [20], [1]]);
  });
});
