/**
 * Shrinks a photo in the browser before upload (faster on venue Wi-Fi, stays under the
 * storage size limit). Returns the original file when the browser can't decode it, e.g. HEIC
 * outside Safari; Cloudinary converts those itself.
 */
export async function resizeImage(file: File, maxSide = 2400, quality = 0.88): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === 'image/jpeg') {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality),
  );
}
