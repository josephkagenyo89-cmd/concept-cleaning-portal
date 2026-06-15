// Booking draft helpers: instant draft creation, debounced autosave, completion %.
// Drafts are persisted via offlineRepo so they work offline-first.
import { createRecord, updateRecord, readRecordById } from '@/lib/offlineRepo';

export interface DraftRef {
  id?: string | null;       // server id (uuid) once synced
  localId: string;          // stable client id for offline-first idempotency
  booking_code?: string | null;
}

export interface DraftCreateInput {
  userId: string;
  userName: string;
  userRole: 'agent' | 'admin' | 'super_admin' | string;
}

/** Create a brand-new draft booking and return its ref. */
export async function createDraftBooking(input: DraftCreateInput): Promise<DraftRef> {
  const now = new Date().toISOString();
  const payload: Record<string, any> = {
    agent_id: input.userId,
    status: 'draft',
    client_name: '',
    client_phone: '',
    location: '',
    service_id: null,
    service_date: null,
    price: 0,
    system_price: 0,
    agent_price: 0,
    agent_margin: 0,
    quantity: '0',
    created_by_name: input.userName,
    created_by_role: input.userRole,
    salesperson_id: input.userId,
    salesperson_name: input.userName,
    salesperson_role: input.userRole,
    line_items: [],
    last_modified_by: input.userId,
    last_modified_by_name: input.userName,
    last_modified_at: now,
    completion_percent: 0,
  };
  const res = await createRecord('bookings', payload);
  // After sync the server fills booking_code; refetch best-effort
  const ref: DraftRef = { localId: res.localId, id: null, booking_code: null };
  return ref;
}

/** Patch a draft (called from debounced auto-save). */
export async function patchDraft(
  ref: DraftRef,
  patch: Record<string, any>,
  audit: { userId: string; userName: string }
) {
  const now = new Date().toISOString();
  await updateRecord(
    'bookings',
    { localId: ref.localId, serverId: ref.id ?? undefined },
    {
      ...patch,
      last_modified_by: audit.userId,
      last_modified_by_name: audit.userName,
      last_modified_at: now,
    }
  );
}

/** Load a draft (or any booking) by id or local id. */
export async function loadBookingDraft(idOrLocalId: string): Promise<any | null> {
  // Try server id first
  let row = await readRecordById('bookings', idOrLocalId, 'id');
  if (!row) row = await readRecordById('bookings', idOrLocalId, 'local_id');
  return row;
}

/** Weighted completion percent across the major sections. */
export function computeCompletionPercent(state: {
  hasClient: boolean;
  serviceCount: number;
  hasDate: boolean;
  priceValid: boolean;
  hasSignatures?: boolean;
}): number {
  let score = 0;
  if (state.hasClient) score += 25;
  if (state.serviceCount > 0) score += 30;
  if (state.hasDate) score += 20;
  if (state.priceValid) score += 20;
  if (state.hasSignatures) score += 5;
  return Math.min(100, score);
}
