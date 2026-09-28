import { createSHA256 } from 'hash-wasm';

const CHUNK = 4 * 1024 * 1024;

/** Streams the file through SHA-256 in chunks so large photos don't spike memory. */
export async function hashFile(blob: Blob): Promise<string> {
  const hasher = await createSHA256();
  hasher.init();
  for (let offset = 0; offset < blob.size; offset += CHUNK) {
    const chunk = await blob.slice(offset, offset + CHUNK).arrayBuffer();
    hasher.update(new Uint8Array(chunk));
  }
  return hasher.digest('hex');
}
