# Booking Drafts & Auto-Save Upgrade

Add a true draft workflow to the Booking module so every "New Booking" click immediately reserves a Booking ID, persists a draft, and auto-saves every change — online or offline — without disturbing the existing quotation/invoice/income/CRM/commission flows.

## What changes for the user

1. Clicking **New Booking** (agent or admin) instantly creates a draft with a code like `BK202600001`. The code is visible at the top of the form.
2. Status lifecycle: **Draft → Pending → Confirmed → Completed → Locked**. Existing statuses keep working; "draft" is the new starting state and the existing lock/invoice/commission triggers stay tied to `fully_confirmed`/`completed`.
3. Every field change (client, services, notes, discount, schedule, signatures, attachments) is auto-saved after a short debounce. A subtle "Saved · just now / Saving… / Offline – queued" indicator replaces the need for a Save button. The existing "Create Booking" button becomes **Confirm Booking** (moves Draft → Pending and runs the existing submit logic).
4. New **Draft Bookings** page (admin + agent) lists drafts with Booking ID, client, status, created/updated dates, and a completion %. Clicking a row resumes editing.
5. A search bar on Drafts and Bookings lets users find a booking by Booking ID, Client ID, name, or phone, then resume editing if still in Draft/Pending.
6. Drafts work fully offline via the existing `offlineRepo` + sync engine; refresh / logout / reconnect restore the draft, its signatures, and any queued attachments.
7. Audit fields (`created_by_name/role`, `last_modified_by`, `last_modified_at`) are written on every auto-save.

## Out of scope (explicitly untouched)

CRM upsert, quotation PDF, auto-invoice trigger, income approval, commission rules, multi-service pricing, discount math, document module, certificate module, pest module.

## Technical plan

### Database migration

Add to `public.bookings`:

- `booking_code text unique` — human Booking ID, format `BK{YYYY}{00000}`.
- `last_modified_by uuid` (nullable, references `auth.users` informally), `last_modified_by_name text`, `last_modified_at timestamptz default now()`.
- `completion_percent int default 0`.
- Extend allowed `status` values to include `'draft'` (existing column is free-text, no enum change needed — just allow it in code/RLS).

Add sequence + function for booking codes:

```text
booking_code_seq  (start 1)
public.next_booking_code() -> 'BK' || extract(year from now()) || lpad(nextval,5,'0')
```

Trigger `assign_booking_code` BEFORE INSERT to populate `booking_code` when null.

RLS: keep existing policies; add allowance so the booking creator (`agent_id = auth.uid()` or admin/super) can read/update their own `draft` rows. The existing select/update policies for agents on their bookings already cover drafts — verify and extend only if needed.

Existing trigger `auto_create_invoice_on_lock` already gates on `fully_confirmed` so drafts will not auto-invoice. No changes there.

### Frontend

- New `src/lib/bookingDrafts.ts`:
    - `createDraftBooking(user, profile)` → inserts a minimal row with `status='draft'` via `offlineRepo.createRecord('bookings', …)`. Returns `{ id?, localId, booking_code? }`. Offline path generates a temporary client-side `BK-LOCAL-…` placeholder shown to the user; once synced, the server-issued `booking_code` replaces it.
    - `autoSaveDraft(ref, patch)` — debounced wrapper around `offlineRepo.updateRecord('bookings', ref, patch)` with `last_modified_by/at` stamped.
    - `computeCompletionPercent(state)` — weighted check of client, services, date, price, signatures.

- New `src/hooks/useAutoSaveDraft.ts` — generic debounce (800ms) + status state (`idle | saving | saved | offline-queued | error`).

- New `src/components/booking/DraftStatusBadge.tsx` — small inline indicator next to the Booking ID header.

- Refactor `src/pages/agent/AgentBooking.tsx`:
    - On mount (no draft id in URL), call `createDraftBooking`, then `navigate('/agent/booking/:id', { replace: true })`.
    - Wire each field setter through `autoSaveDraft`.
    - Replace the legacy `savePending` offline path — drafts are now the offline path.
    - "Create Booking" becomes "Confirm Booking" → calls `updateRecord` with `status='pending'`, then runs the existing post-confirm logic (CRM upsert is already there, quotation auto-doc stays).

- Mirror changes in `src/pages/admin/AdminBookService.tsx`.

- New `src/pages/admin/AdminDraftBookings.tsx` and `src/pages/agent/AgentDraftBookings.tsx` (thin wrappers around a shared `DraftBookingsList` component) — list `status='draft'` rows scoped by role, with search by code/client/phone, "Resume" button routes to the booking editor.

- Add routes in `src/App.tsx`:
    - `/agent/bookings/new` (creates + redirects), `/agent/bookings/:id` (resume), `/agent/bookings/drafts`
    - `/admin/bookings/new`, `/admin/bookings/:id`, `/admin/bookings/drafts`

- Add nav entries in `AdminLayout.tsx` ("Drafts") and `AgentBottomNav.tsx`/`AgentLayout.tsx` ("Drafts").

- `AdminBookings.tsx`: hide `status='draft'` from the main list (drafts live in the new module), and add a "Search & Resume" input that jumps to a draft/pending if found.

### Offline resilience

Drafts are written via `offlineRepo` so they land in IndexedDB immediately. Signatures (base64) and attachments use the existing `signatures` / `photos` stores keyed by `localId`. Reload restores from IndexedDB; sync engine flushes inserts/updates in FIFO with `local_id` idempotency (already implemented).

### Safety checks

- `auto_create_invoice_on_lock` fires only on `fully_confirmed` — drafts never auto-invoice.
- `upsertClientForBooking` runs only on Confirm, not on draft creation — no CRM noise from abandoned drafts.
- Auto-quotation generation stays on Confirm.

## Deliverables

1. SQL migration: `booking_code`, sequence, function, trigger, audit columns, completion_percent.
2. New lib + hook + components listed above.
3. Refactored agent/admin booking editors + new Drafts pages + routes + nav links.
4. No changes to CRM, quotation, invoice, income, commission, discount, or pest modules.
