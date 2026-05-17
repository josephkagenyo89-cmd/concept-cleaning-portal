// Sync engine: drains the IndexedDB sync queue to Supabase with safe retries.
import { supabase } from '@/integrations/supabase/client';
import {
  queuePending,
  queueUpdate,
  queueDelete,
  cacheGet,
  cachePut,
  cacheMarkSynced,
  cacheAll,
  getPhoto,
  deletePhoto,
  QueueItem,
  TableStore,
} from './offlineDb';

let syncing = false;
let listeners = new Set<(pending: number) => void>();

export function onSyncStatus(fn: (pending: number) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
async function emit() {
  const n = (await queuePending()).length;
  listeners.forEach((l) => { try { l(n); } catch {} });
}

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [0, 2_000, 5_000, 15_000, 60_000];

async function resolveParents(item: QueueItem): Promise<{ ok: boolean; payload: any }> {
  if (!item.parentLocalIds) return { ok: true, payload: item.payload };
  const payload = { ...item.payload };
  for (const [field, parentLocalId] of Object.entries(item.parentLocalIds)) {
    // Search all known table caches (we don't know which table the parent is in; payload's field name hints)
    // Convention: field like "booking_id" -> table "bookings"
    const tableGuess = (field.replace(/_id$/, '') + 's') as TableStore;
    let parent = await cacheGet(tableGuess, parentLocalId).catch(() => undefined);
    if (!parent?.serverId) {
      // Try other plausible tables
      for (const t of ['bookings','clients','invoices','quotations','pest_jobs'] as TableStore[]) {
        const p = await cacheGet(t, parentLocalId).catch(() => undefined);
        if (p?.serverId) { parent = p; break; }
      }
    }
    if (!parent?.serverId) return { ok: false, payload };
    payload[field] = parent.serverId;
  }
  return { ok: true, payload };
}

async function processItem(item: QueueItem): Promise<void> {
  if (item.op === 'storage_upload') {
    if (!item.bucket || !item.path || !item.blobKey) throw new Error('Invalid storage_upload item');
    const rec = await getPhoto(item.blobKey);
    if (!rec) { await queueDelete(item.id); return; }
    const { error } = await supabase.storage.from(item.bucket).upload(item.path, rec.blob, {
      contentType: rec.contentType, upsert: true,
    });
    if (error) throw error;
    await deletePhoto(item.blobKey);
    item.synced = true;
    await queueUpdate(item);
    return;
  }

  const { ok, payload } = await resolveParents(item);
  if (!ok) throw new Error('Parent not yet synced');

  if (item.op === 'insert') {
    const { data, error } = await (supabase as any)
      .from(item.table)
      .upsert(payload, { onConflict: 'local_id' })
      .select()
      .single();
    if (error) throw error;
    await cacheMarkSynced(item.table, item.localId, data.id, data);
  } else if (item.op === 'update') {
    const target = payload.__target as { localId: string; serverId: string | null };
    delete payload.__target;
    let query = (supabase as any).from(item.table).update(payload);
    if (target.serverId) query = query.eq('id', target.serverId);
    else query = query.eq('local_id', item.localId);
    const { error } = await query;
    if (error) throw error;
    const row = await cacheGet(item.table, item.localId);
    if (row) {
      row.synced = true;
      row.lastUpdated = new Date().toISOString();
      await cachePut(item.table, row);
    }
  }
  item.synced = true;
  await queueUpdate(item);
}

export async function triggerSync(): Promise<void> {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  try {
    const pending = await queuePending();
    for (const item of pending) {
      if (item.attempts >= MAX_ATTEMPTS) continue;
      const delay = BACKOFF_MS[Math.min(item.attempts, BACKOFF_MS.length - 1)];
      if (delay > 0 && Date.now() - new Date(item.createdAt).getTime() < delay * item.attempts) continue;
      try {
        await processItem(item);
      } catch (e: any) {
        item.attempts += 1;
        item.lastError = e?.message || String(e);
        await queueUpdate(item);
      }
    }
  } finally {
    syncing = false;
    await emit();
  }
}

let intervalId: number | null = null;
export function startSyncLoop() {
  if (intervalId !== null) return;
  intervalId = window.setInterval(() => {
    if (navigator.onLine) triggerSync().catch(() => {});
  }, 60_000);
  window.addEventListener('online', () => triggerSync().catch(() => {}));
  if (navigator.onLine) triggerSync().catch(() => {});
}
export function stopSyncLoop() {
  if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
}

export async function getPendingCount(): Promise<number> {
  return (await queuePending()).length;
}

// Touch: keep cacheAll import alive if tree-shaken environments complain
void cacheAll;
