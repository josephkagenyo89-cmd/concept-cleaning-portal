## Pest Management Module

A dedicated workflow for pest control jobs that lives alongside the existing cleaning system without altering it. Pest jobs are linked to existing CRM clients and (optionally) bookings, and produce their own certificate type with chemicals, safety, and warranty info.

### Scope (what this adds)

- New admin section **Pest Control** in the sidebar with three pages:
  - **Pest Jobs** — list, search, create, open job
  - **Chemical Log** — aggregated chemical usage across all jobs
  - **Revisits** — upcoming follow-ups / warranty expiries
- A **Pest Job detail page** with tabs:
  1. Inspection (pest type, infestation level, affected areas, client observations, technician notes)
  2. Treatment (chemicals used + dosage + equipment + method, PPE, safety instructions)
  3. Areas Treated (list of rooms/zones)
  4. Photos (before / after / evidence — uploaded to Lovable Cloud storage)
  5. Follow-ups (scheduled revisits, re-inspections, retreatments)
  6. Warranty (period in days, expiry date, free-revisit eligibility flag)
  7. Certificate (generate Pest Control Certificate PDF after client signature + payment)
  8. Feedback (reuses existing FeedbackDialog)

### Database (new tables only — nothing existing is touched)

```text
pest_jobs                — header per pest job, links to client_id + optional booking_id/invoice_id
pest_inspections         — 1:1 with job (inspection form fields)
pest_treatments          — 1:N (each treatment session: chemicals/dosage/equipment/method/PPE)
pest_chemical_usage      — 1:N (per-chemical line items: name, quantity, unit, technician)
pest_areas_treated       — 1:N (area/zone label per job/treatment)
pest_followups           — 1:N (type=followup|reinspection|retreatment, scheduled_date, status, notes)
pest_photos              — 1:N (storage path, kind=before|after|evidence)
pest_certificates        — 1:N (issued certificates with warranty_days + warranty_expiry)
```

Plus a storage bucket `pest-photos` (private, RLS-scoped to admins/super admins). Sequence + function `next_pest_certificate_number()` returning `CCS-PEST-####`. RLS: admins/super-admins manage; agents read jobs they created.

### Integration points (read-only into existing modules)

- **CRM**: pest job creation uses the existing `ClientSearchSelector`; saving a pest job updates `clients.last_booking_date` and `total_spend` only when an invoice is paid (via existing flow — we just create an invoice with `service='Pest Control'` linked to `pest_job_id` stored in `notes`).
- **Quotations / Invoices / Receipts / Income**: reuse existing `quotations`, `invoices`, `income_records` by setting service text to "Pest Control – {pest_type}" and linking via `client_id`. No changes to those tables.
- **Documents**: certificates are generated through a new `pestCertificate.ts` PDF generator (mirrors `serviceCertificates.ts`) and recorded in the existing `documents` table with `document_type='pest_certificate'`.
- **Feedback**: after issuing a pest certificate the existing `FeedbackDialog` opens.

### UI / Routes

- `/admin/pest` → `AdminPestJobs.tsx`
- `/admin/pest/:id` → `AdminPestJobDetail.tsx`
- `/admin/pest/chemicals` → `AdminPestChemicals.tsx`
- `/admin/pest/revisits` → `AdminPestRevisits.tsx`

Sidebar gets a "Pest Control" group above "ERP & Accounting".

Mobile-first layouts, semantic tokens only, lazy-loaded routes.

### Safety guardrails

- No edits to cleaning booking flow, certificate flow, income approval, or document generator — we add new files/tables and one sidebar entry + one App.tsx route block.
- Photos go to a new `pest-photos` bucket (existing buckets unchanged).
- Pest certificate generation requires: client signature on job + linked invoice marked paid (same pattern as cleaning certificates).

### Files to create

- `supabase/migrations/<ts>_pest_management.sql` (tables, RLS, storage bucket, sequence, helper fn)
- `src/lib/pestCertificate.ts`
- `src/pages/admin/AdminPestJobs.tsx`
- `src/pages/admin/AdminPestJobDetail.tsx`
- `src/pages/admin/AdminPestChemicals.tsx`
- `src/pages/admin/AdminPestRevisits.tsx`
- `src/components/pest/PestInspectionForm.tsx`
- `src/components/pest/PestTreatmentForm.tsx`
- `src/components/pest/PestAreasManager.tsx`
- `src/components/pest/PestFollowupsManager.tsx`
- `src/components/pest/PestPhotosUploader.tsx`
- `src/components/pest/PestWarrantyCard.tsx`
- `src/components/pest/GeneratePestCertificateButton.tsx`

### Files to edit (minimal)

- `src/App.tsx` — add 4 lazy routes
- `src/layouts/AdminLayout.tsx` — add "Pest Control" sidebar group

### Order of work

1. Create migration (tables + RLS + storage bucket + sequence) — wait for approval.
2. Build pest job list + detail shell with tabs and CRM client picker.
3. Inspection / Treatment / Chemical / Areas / Photos / Follow-up / Warranty sub-modules.
4. Pest certificate PDF generator + button (gated on signature + paid invoice).
5. Wire sidebar, routes, feedback dialog reuse.
6. QA: create a pest job end-to-end on mobile viewport.

Approve to proceed and I'll start with the database migration.
