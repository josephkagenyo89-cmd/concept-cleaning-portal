/**
 * Shared client-side image preparation for uploads across the application.
 * All uploaded photos are converted to WebP and capped at 20 KiB.
 */
export const MAX_UPLOAD_IMAGE_BYTES = 20 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function compressImageToWebP(file: File, maxBytes = MAX_UPLOAD_IMAGE_BYTES): Promise<Blob> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG or WebP image.');
  if (!file.size) throw new Error('The selected image is empty.');
  if (typeof createImageBitmap !== 'function') throw new Error('This browser does not support image compression. Please use a recent browser.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this image.');
    const scales = [1, 0.85, 0.7, 0.58, 0.48, 0.38, 0.3, 0.24, 0.19, 0.15, 0.12, 0.09, 0.06];
    const qualities = [0.82, 0.7, 0.58, 0.46, 0.34, 0.24, 0.16, 0.1, 0.07];
    for (const scale of scales) {
      const factor = Math.min(scale, 1600 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * factor));
      canvas.height = Math.max(1, Math.round(bitmap.height * factor));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of qualities) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob || blob.type !== 'image/webp') throw new Error('This browser cannot encode WebP images.');
        if (blob.size > 0 && blob.size <= maxBytes) return blob;
      }
    }
    throw new Error('This image cannot be reduced to 20 KB. Try a simpler image with fewer details.');
  } finally { bitmap.close(); }
}
