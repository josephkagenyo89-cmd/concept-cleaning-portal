// Multi-store IndexedDB layer for offline-first operation.
// Stores: per-table caches, signatures, photos, pdfs, sync_queue.
// Backward-compatible with previous `pending_sync` API used by AgentBooking.

const DB_NAME = 'concept-cleaning-offline';
const DB_VERSION = 2;

export const TABLE_STORES = [
  'bookings',
  'clients',
  'invoices',
  'quotations',
  'service_certificates',
  'pest_jobs',
  'pest_inspections',
  'pest_treatments',
  'pest_chemical_usage',
  'pest_followups',
  'customer_feedback',
  'pest_photos',
] as const;
export type TableStore = (typeof TABLE_STORES)[number];

const AUX_STORES = ['signatures', 'photos', 'pdfs', 'sync_queue', 'pending_sync'] as const;

export interface CachedRow {
  localId: string;
  serverId?: string | null;
  data: Record<string, any>;
  synced: boolean;
  offlineCreated: boolean;
  lastUpdated: string;
}

export interface QueueItem {
  id: string;
  table: TableStore;
  op: 'insert' | 'update' | 'storage_upload';
  payload: Record<string, any>;
  localId: string;
  parentLocalIds?: Record<string, string>; // { fieldName: parentLocalId }
  createdAt: string;
  attempts: number;
  lastError?: string;
  synced: boolean;
  // for storage_upload:
  bucket?: string;
  path?: string;
  blobKey?: string; // key in `photos` store
}

export interface PendingItem {
  localId: string;
  type: 'booking';
  data: Record<string, any>;
  createdAt: string;
  synced: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of TABLE_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'localId' });
        }
      }
      for (const name of AUX_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const keyPath = name === 'pending_sync' ? 'localId' : (name === 'sync_queue' ? 'id' : 'key');
          db.createObjectStore(name, { keyPath });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => Promise<T> | T): Promise<T> {
  return openDb().then((db) =>
    new Promise<T>((resolve, reject) => {
      const t = db.transaction(stores, mode);
      const out = fn(t);
      t.oncomplete = () => Promise.resolve(out).then(resolve, reject);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    })
  );
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function newLocalId(): string {
  return (crypto.randomUUID?.() ?? `lid_${Date.now()}_${Math.random().toString(36).slice(2)}`);
}

// ---------- Table cache ----------
export async function cachePut(table: TableStore, row: CachedRow): Promise<void> {
  await tx([table], 'readwrite', (t) => req(t.objectStore(table).put(row)));
}
export async function cacheGet(table: TableStore, localId: string): Promise<CachedRow | undefined> {
  return tx([table], 'readonly', (t) => req(t.objectStore(table).get(localId)));
}
export async function cacheAll(table: TableStore): Promise<CachedRow[]> {
  return tx([table], 'readonly', (t) => req(t.objectStore(table).getAll() as IDBRequest<CachedRow[]>));
}
export async function cacheUnsynced(table: TableStore): Promise<CachedRow[]> {
  const all = await cacheAll(table);
  return all.filter((r) => !r.synced);
}
export async function cacheMarkSynced(table: TableStore, localId: string, serverId: string, serverData?: Record<string, any>): Promise<void> {
  const row = await cacheGet(table, localId);
  if (!row) return;
  row.synced = true;
  row.serverId = serverId;
  if (serverData) row.data = { ...row.data, ...serverData };
  row.lastUpdated = new Date().toISOString();
  await cachePut(table, row);
}

// ---------- Sync queue ----------
export async function enqueue(item: Omit<QueueItem, 'id' | 'attempts' | 'synced' | 'createdAt'> & Partial<Pick<QueueItem, 'createdAt'>>): Promise<QueueItem> {
  const full: QueueItem = {
    id: newLocalId(),
    attempts: 0,
    synced: false,
    createdAt: item.createdAt ?? new Date().toISOString(),
    ...item,
  };
  await tx(['sync_queue'], 'readwrite', (t) => req(t.objectStore('sync_queue').put(full)));
  return full;
}
export async function queueAll(): Promise<QueueItem[]> {
  return tx(['sync_queue'], 'readonly', (t) => req(t.objectStore('sync_queue').getAll() as IDBRequest<QueueItem[]>));
}
export async function queuePending(): Promise<QueueItem[]> {
  const all = await queueAll();
  return all.filter((q) => !q.synced).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export async function queuePendingCount(): Promise<number> {
  return (await queuePending()).length;
}
export async function queueUpdate(item: QueueItem): Promise<void> {
  await tx(['sync_queue'], 'readwrite', (t) => req(t.objectStore('sync_queue').put(item)));
}
export async function queueDelete(id: string): Promise<void> {
  await tx(['sync_queue'], 'readwrite', (t) => req(t.objectStore('sync_queue').delete(id)));
}
export async function queueClearSynced(): Promise<void> {
  const all = await queueAll();
  await tx(['sync_queue'], 'readwrite', (t) => {
    const s = t.objectStore('sync_queue');
    for (const q of all) if (q.synced) s.delete(q.id);
    return Promise.resolve();
  });
}

// ---------- Photos / blobs ----------
export interface PhotoBlobRecord { key: string; blob: Blob; contentType: string; createdAt: string; meta?: Record<string, any>; }
export async function putPhoto(rec: PhotoBlobRecord): Promise<void> {
  await tx(['photos'], 'readwrite', (t) => req(t.objectStore('photos').put(rec)));
}
export async function getPhoto(key: string): Promise<PhotoBlobRecord | undefined> {
  return tx(['photos'], 'readonly', (t) => req(t.objectStore('photos').get(key)));
}
export async function deletePhoto(key: string): Promise<void> {
  await tx(['photos'], 'readwrite', (t) => req(t.objectStore('photos').delete(key)));
}

// ---------- Signatures ----------
export interface SignatureRecord { key: string; dataUrl: string; createdAt: string; meta?: Record<string, any>; }
export async function putSignature(rec: SignatureRecord): Promise<void> {
  await tx(['signatures'], 'readwrite', (t) => req(t.objectStore('signatures').put(rec)));
}
export async function getSignature(key: string): Promise<SignatureRecord | undefined> {
  return tx(['signatures'], 'readonly', (t) => req(t.objectStore('signatures').get(key)));
}

// ---------- PDFs ----------
export interface PdfRecord { key: string; blob: Blob; filename: string; createdAt: string; }
export async function putPdf(rec: PdfRecord): Promise<void> {
  await tx(['pdfs'], 'readwrite', (t) => req(t.objectStore('pdfs').put(rec)));
}
export async function getPdf(key: string): Promise<PdfRecord | undefined> {
  return tx(['pdfs'], 'readonly', (t) => req(t.objectStore('pdfs').get(key)));
}

// ---------- Backward-compatible legacy API ----------
export async function savePending(item: PendingItem) {
  await tx(['pending_sync'], 'readwrite', (t) => req(t.objectStore('pending_sync').put(item)));
}
export async function getPending(): Promise<PendingItem[]> {
  const all = await tx(['pending_sync'], 'readonly', (t) =>
    req(t.objectStore('pending_sync').getAll() as IDBRequest<PendingItem[]>)
  );
  return all.filter((i) => !i.synced);
}
export async function markSynced(localId: string) {
  await tx(['pending_sync'], 'readwrite', (t) => {
    const s = t.objectStore('pending_sync');
    const r = s.get(localId);
    r.onsuccess = () => {
      if (r.result) {
        r.result.synced = true;
        s.put(r.result);
      }
    };
    return Promise.resolve();
  });
}
export async function clearSynced() {
  const all = await tx(['pending_sync'], 'readonly', (t) =>
    req(t.objectStore('pending_sync').getAll() as IDBRequest<PendingItem[]>)
  );
  await tx(['pending_sync'], 'readwrite', (t) => {
    const s = t.objectStore('pending_sync');
    for (const i of all) if (i.synced) s.delete(i.localId);
    return Promise.resolve();
  });
}

export async function isAvailable(): Promise<boolean> {
  try { await openDb(); return true; } catch { return false; }
}
