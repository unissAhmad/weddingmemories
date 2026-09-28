import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { decode } from 'blurhash';
import { blurhashFromImage, parseRenditionInfo } from '../src/lib/image';

describe('blurhashFromImage', () => {
  it('encodes a small rendition into a valid blurhash', async () => {
    const tiny = await sharp({
      create: { width: 32, height: 24, channels: 3, background: { r: 200, g: 170, b: 150 } },
    })
      .jpeg()
      .toBuffer();
    const hash = await blurhashFromImage(tiny);
    expect(hash.length).toBeGreaterThan(10);
    // Decodes back to pixels close to the source colour (blurhash quantizes, so allow some drift).
    const pixels = decode(hash, 4, 4);
    expect(Math.abs(pixels[0]! - 200)).toBeLessThan(30);
  });

  it('rejects data that is not an image', async () => {
    await expect(blurhashFromImage(Buffer.from('nope'))).rejects.toThrow();
  });
});

describe('parseRenditionInfo', () => {
  it('reads the rotated output size from fl_getinfo JSON', () => {
    const json = { input: { width: 4032, height: 3024 }, output: { format: 'jpg', width: 1200, height: 1600 } };
    expect(parseRenditionInfo(json)).toEqual({ width: 1200, height: 1600 });
  });

  it('returns null for unexpected responses', () => {
    expect(parseRenditionInfo({ error: 'x' })).toBeNull();
    expect(parseRenditionInfo(null)).toBeNull();
  });
});
