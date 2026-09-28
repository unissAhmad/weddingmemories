import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { DISPLAY_WIDTH, THUMB_WIDTH, isHeif, processImage, sha256 } from '../src/lib/image';

/** A 3000x2000 landscape JPEG stored sideways with EXIF orientation 6 (rotate 90° CW). */
async function sidewaysPhotoWithGps() {
  return sharp({
    create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 170, b: 150 } },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Make: 'TestCam' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '34/1 5/1 0/1' },
    })
    .toBuffer();
}

describe('processImage', () => {
  it('applies EXIF orientation, resizes, and strips all metadata', async () => {
    const original = await sidewaysPhotoWithGps();
    const out = await processImage(original);

    // Orientation 6 turns 3000x2000 into a 2000x3000 portrait before resizing.
    expect(out.display.width).toBe(DISPLAY_WIDTH);
    expect(out.display.height).toBe(2400);
    expect(out.thumb.width).toBe(THUMB_WIDTH);
    expect(out.thumb.height).toBe(600);

    for (const buf of [out.display.data, out.thumb.data]) {
      const meta = await sharp(buf).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    }

    expect(out.blurhash).toMatch(/^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{20,}$/);
  });

  it('never enlarges small images', async () => {
    const small = await sharp({
      create: { width: 300, height: 200, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer();
    const out = await processImage(small);
    expect(out.display.width).toBe(300);
    expect(out.thumb.width).toBe(300);
  });

  it('rejects corrupt files', async () => {
    await expect(processImage(Buffer.from('definitely not an image'))).rejects.toThrow();
  });
});

describe('helpers', () => {
  it('detects HEIF by ftyp brand', () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic0000')]);
    const avif = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypavif0000')]);
    expect(isHeif(heic)).toBe(true);
    expect(isHeif(avif)).toBe(false);
    expect(isHeif(Buffer.from([0xff, 0xd8, 0xff]))).toBe(false);
  });

  it('hashes deterministically', () => {
    expect(sha256(Buffer.from('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
