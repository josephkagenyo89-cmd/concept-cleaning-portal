// Offline-first repository: writes to IndexedDB immediately, queues sync.
// All offline-created records get a stable `local_id` for safe retry on the server.
import { supabase } from '@/integrations/supabase/client';
import {
  TableStore,
  cachePut,
  cacheGet,
  cacheUnsynced,
  cacheMarkSynced,
  enqueue,
  newLocalId,
  CachedRow,
} from './offlineDb';
import { triggerSync } from './offlineSyncEngine';

export interface CreateResult<T = any> {
  localId: string;
  serverId?: string;
  data: T;
  offline: boolean;
}

/** Create a row: persist locally with local_id, enqueue insert, attempt immediate sync if online. */
export async function createRecord<T extends Record<string, any>>(
  table: TableStore,
  payload: T,
  opts?: { parentLocalIds?: Record<string, string> }
): Promise<CreateResult<T & { local_id: string }>> {
  const localId = newLocalId();
  const withLocal: T & { local_id: string } = { ...payload, local_id: localId };
  const row: CachedRow = {
    localId,
    serverId: null,
    data: withLocal,
    synced: false,
    offlineCreated: !navigator.onLine,
    lastUpdated: new Date().toISOString(),
  };
  await cachePut(table, row);
  await enqueue({
    table,
    op: 'insert',
    payload: withLocal,
    localId,
    parentLocalIds: opts?.parentLocalIds,
  });

  // Try immediate sync when online
  if (navigator.onLine) {
    triggerSync().catch(() => {});
  }

  return { localId, data: withLocal, offline: !navigator.onLine };
}

/** Update a previously-created (online or offline) row. */
export async function updateRecord(
  table: TableStore,
  ref: { localId?: string; serverId?: string },
  patch: Record<string, any>
): Promise<void> {
  let localId = ref.localId;
  if (!localId) {
    // Find by serverId
    const all = await cacheUnsynced(table);
    const found = all.find((r) => r.serverId === ref.serverId);
    localId = found?.localId;
  }
  if (!localId) {
    // Not in cache — write a stub so we can queue the update
    localId = newLocalId();
    await cachePut(table, {
      localId,
      serverId: ref.serverId ?? null,
      data: { ...patch },
      synced: false,
      offlineCreated: false,
      lastUpdated: new Date().toISOString(),
    });
  } else {
    const row = await cacheGet(table, localId);
    if (row) {
      row.data = { ...row.data, ...patch };
      row.synced = false;
      row.lastUpdated = new Date().toISOString();
      await cachePut(table, row);
    }
  }
  await enqueue({
    table,
    op: 'update',
    payload: { ...patch, __target: { localId, serverId: ref.serverId ?? null } },
    localId: localId!,
  });
  if (navigator.onLine) triggerSync().catch(() => {});
}

/** Read: live network, falling back to cache when offline or on failure. */
export async function readRecords(
  table: TableStore,
  query?: (q: any) => any
): Promise<any[]> {
  if (navigator.onLine) {
    try {
      let q: any = (supabase as any).from(table).select('*');
      if (query) q = query(q);
      const { data, error } = await q;
      if (!error && data) {
        // Refresh cache opportunistically
        for (const r of data) {
          await cachePut(table, {
            localId: r.local_id ?? r.id,
            serverId: r.id,
            data: r,
            synced: true,
            offlineCreated: false,
            lastUpdated: new Date().toISOString(),
          });
        }
        // Merge with unsynced local rows
        const unsynced = (await cacheUnsynced(table)).map((r) => r.data);
        return [...data, ...unsynced.filter((u: any) => !data.find((d: any) => d.local_id && d.local_id === u.local_id))];
      }
    } catch { /* fall through to cache */ }
  }
  const cached = await (await import('./offlineDb')).cacheAll(table);
  return cached.map((r) => r.data);
}

export async function readRecordById(
  table: TableStore,
  id: string,
  column: 'id' | 'local_id' = 'id'
): Promise<any | null> {
  if (navigator.onLine) {
    try {
      const { data, error } = await (supabase as any)
        .from(table)
        .select('*')
        .eq(column, id)
        .maybeSingle();

      if (!error && data) {
        await cachePut(table, {
          localId: data.local_id ?? data.id,
          serverId: data.id,
          data,
          synced: true,
          offlineCreated: false,
          lastUpdated: new Date().toISOString(),
        });
        return data;
      }
    } catch {
      // fall through to cache
    }
  }

  const cached = await (await import('./offlineDb')).cacheAll(table);
  const match = cached.find((row) => row.serverId === id || row.localId === id || row.data?.id === id || row.data?.local_id === id);
  return match?.data ?? null;
}

export async function seedCache(table: TableStore, rows: Record<string, any>[]): Promise<void> {
  const now = new Date().toISOString();
  for (const row of rows) {
    const localId = row.local_id ?? row.id;
    if (!localId) continue;
    await cachePut(table, {
      localId,
      serverId: row.id ?? null,
      data: row,
      synced: !row.local_id || row.id === row.local_id || row.id != null,
      offlineCreated: false,
      lastUpdated: now,
    });
  }
}

export { cacheMarkSynced };
