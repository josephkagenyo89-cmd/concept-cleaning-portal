// Cache generated PDFs in IndexedDB so they can be re-downloaded offline.
import { putPdf, getPdf } from './offlineDb';

export async function cachePdf(key: string, blob: Blob, filename: string): Promise<void> {
  try {
    await putPdf({ key, blob, filename, createdAt: new Date().toISOString() });
  } catch (e) {
    console.warn('PDF cache failed:', e);
  }
}

export async function downloadCachedPdf(key: string): Promise<boolean> {
  const rec = await getPdf(key).catch(() => undefined);
  if (!rec) return false;
  const url = URL.createObjectURL(rec.blob);
  const a = document.createElement('a');
  a.href = url; a.download = rec.filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
