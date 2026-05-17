## Offline-First Upgrade Plan

Make Concept Cleaning Services keep working without internet, then safely sync to Lovable Cloud when connectivity returns. No existing workflows, CRM rules, income approval logic, or document formatting changes — we only add a local storage + sync layer behind them.

### 1. Local storage foundation (IndexedDB)

Expand `src/lib/offlineDb.ts` from a single `pending_sync` store into a proper multi-store IndexedDB database (`concept-cleaning-offline`, version 2):

- `bookings`, `clients`, `invoices`, `quotations`, `receipts`, `service_certificates`, `pest_jobs`, `pest_inspections`, `pest_treatments`, `pest_chemical_usage`, `pest_followups`, `customer_feedback`
- `signatures` (base64 PNG blobs keyed by `{type, parentLocalId}`)
- `photos` (Blob + metadata, keyed by localId, linked to `pest_jobs`)
- `pdfs` (generated PDF Blobs keyed by document number)
- `sync_queue` (ordered mutation log: `{ id, table, op: 'insert'|'update', payload, localId, parentLocalIds, createdAt, attempts, lastError, synced }`)

Every cached record carries `synced: boolean`, `lastUpdated: ISO`, `offlineCreated: boolean`, and a `localId` (UUID generated client-side, used for idempotency and to link children to a not-yet-uploaded parent).

### 2. Unified data access layer

New `src/lib/offlineRepo.ts` wraps Supabase reads/writes for each supported table:

- `read(table, filter)` → returns the union of cached rows + live Supabase rows (cache-first when offline, network-first when online with cache fallback).
- `create(table, payload)` → writes to IndexedDB immediately with `synced:false, offlineCreated:true`, enqueues a `sync_queue` entry, and (if online) attempts immediate flush.
- `update(table, id|localId, patch)` → patches local copy, enqueues update.
- Safe-merge rule: server row wins on scalar fields when `server.updated_at > local.lastUpdated`; otherwise local pending changes are reapplied on top. Inserts use `localId` as an idempotency key stored in a new nullable `local_id` column on each synced table to prevent duplicates on retry.

Existing pages keep calling `supabase.from(...)` for now; we migrate the highest-value flows (booking create, client create, pest job create, signature capture, feedback submit, certificate issue) to `offlineRepo` so they no longer block on the network.

### 3. Sync engine

Replace `src/hooks/useOfflineSync.ts` with a queue-driven engine:

- Triggers: app mount (if online), `window` `online` event, every 60s while online, and after each local mutation.
- Processes `sync_queue` in FIFO order. For each item:
  1. Resolve any `parentLocalIds` to their now-known server UUIDs (look up in local cache where the parent insert response was stored).
  2. Send insert/update to Supabase using `local_id` for idempotency (insert uses `upsert(..., { onConflict: 'local_id' })` where the column exists).
  3. On success: mark queue entry `synced`, update local row with returned server id + `synced:true`.
  4. On failure: increment `attempts`, store `lastError`, exponential backoff (max 5 retries, then surface in a "Sync issues" toast).
- A single migration adds nullable `local_id text unique` columns to: `bookings, clients, invoices, quotations, service_certificates, pest_jobs, pest_inspections, pest_treatments, pest_chemical_usage, pest_followups, customer_feedback`. No existing data is touched.

### 4. Offline document generation

`documentPdf.ts`, `quotationPdf.ts`, `serviceCertificates.ts`, `pestCertificate.ts` already build PDFs client-side with jsPDF — they work offline today. We add:

- Cache the generated PDF Blob in the `pdfs` store keyed by `document_number` (or `localId` when no number yet) so users can re-download offline.
- When offline, document/certificate numbers fall back to a local format `OFFLINE-{table}-{shortLocalId}`; the sync engine replaces the placeholder with the real server-issued number on first successful upload (via the existing `next_*_number()` functions) and regenerates the cached PDF.

### 5. Offline signatures and photos

- Signature capture (`StaffSignatureDialog`, client signature page, pest job signature pad) writes base64 to the `signatures` store and patches the parent record locally; sync uploads them as part of the parent record's update payload.
- Pest photos (`PestPhotosUploader`) store the original `File`/`Blob` in the `photos` store and create a `sync_queue` entry of type `storage_upload` targeting the `pest-photos` bucket. Sync uploads the blob, then inserts the `pest_photos` row with the resulting `storage_path`.

### 6. Service worker / PWA shell

To prevent white screens when offline:

- Add `vite-plugin-pwa` with `registerType: 'autoUpdate'`, precache the app shell (JS/CSS/fonts/icons), runtime-cache Supabase GET responses with `NetworkFirst` (5s timeout → cache fallback), and runtime-cache images with `CacheFirst`.
- Keep `/~oauth` and `/sign` on `navigateFallbackDenylist`.
- `manifest.json` already exists; we wire it through the plugin.

### 7. UI surface

- `NetworkStatus` banner already exists — extend it to show "Syncing N pending changes…" with a count from `sync_queue`, and a "Synced ✓" pulse when the queue empties.
- Add small "Saved offline" badges on records where `synced === false` in list views (Bookings, Clients, Pest Jobs, Certificates, Feedback).
- No layout, navigation, or business-rule changes beyond these badges.

### Safety guarantees

- Income approval, commission triggers, RLS policies, document generator output, CRM lifecycle, and existing edge functions are untouched.
- The `local_id` columns are additive and nullable — existing rows and queries are unaffected.
- All offline writes still pass through the same RLS-protected Supabase calls on sync, so server-side authorization is unchanged.
- If IndexedDB is unavailable (private mode, quota exceeded), the app falls back to direct Supabase calls with a one-time warning toast.

### Deliverables

- Migration: add `local_id` columns + unique indexes.
- New: `src/lib/offlineRepo.ts`, `src/lib/offlineSyncEngine.ts`, `src/lib/offlinePdfCache.ts`, `src/lib/offlinePhotoQueue.ts`.
- Rewritten: `src/lib/offlineDb.ts` (multi-store), `src/hooks/useOfflineSync.ts`.
- Updated: `NetworkStatus.tsx`, `vite.config.ts` (PWA plugin), booking/client/pest/feedback/signature/certificate call sites switched to `offlineRepo`.
- Package add: `vite-plugin-pwa`, `workbox-window`.

Approve and I'll execute the migration first, then ship the code in one pass.
