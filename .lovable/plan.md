# Booking Discount System

Add discount support to the Booking Module so an agreed discount flows automatically into quotations, invoices, receipts, certificates, income records, and client CRM — without disturbing existing commission, multi-service, or approval logic.

## Scope

In scope: booking form UI, calculation engine, document propagation (quotation/invoice/receipt/SCC), approval workflow, CRM display, reporting filter.
Out of scope: changes to commission tier formulas, invoice/income approval workflow rules, pest module.

## 1. Database (single migration)

Add to `public.bookings`:
- `subtotal numeric` — sum of line items before discount
- `discount_type text` — `'percent' | 'fixed' | null`
- `discount_value numeric default 0`
- `discount_amount numeric default 0` — computed at save time
- `discount_reason text`
- `discount_approval_status text default 'not_required'` — `not_required | pending | approved | rejected`
- `discount_approved_by uuid`
- `discount_approved_at timestamptz`

Mirror discount fields on `quotations`, `invoices`, `service_certificates`, `income_records` (subtotal, discount_amount, discount_reason). `price`/`amount`/`total` columns continue to store the FINAL (post-discount) value so all existing downstream code keeps working. Discount fields are additive.

Approval rule (enforced in app, not DB):
- Agent + discount > 0 → `pending`
- Admin or Super Admin → auto `approved` with their id
- Booking cannot move past `pending` status until discount is approved

## 2. Shared library

New `src/lib/discounts.ts`:
- `computeDiscount(subtotal, type, value)` → `{ discountAmount, finalTotal }`
- `formatDiscountLabel(type, value)` → e.g. `10% off` or `KSh 500 off`
- `needsApproval(role)` → `role === 'agent'`

## 3. Booking forms

`src/pages/agent/AgentBooking.tsx` and `src/pages/admin/AdminBookService.tsx`:
- New Discount card below Services: Type select, Value input, Reason text.
- Replace `systemPrice` math with subtotal → discount → final. "Your Price" minimum becomes `finalTotal` (so agent margin still works on top).
- Payload writes new discount columns + `discount_approval_status`.
- Pass discount to `autoCreateQuotationForBooking`.

## 4. Document generators

- `src/lib/autoDocuments.ts`, `src/lib/quotationPdf.ts`, `src/lib/documentPdf.ts`, `src/lib/serviceCertificates.ts`: accept optional `subtotal`, `discountAmount`, `discountReason`. PDF totals block renders `Subtotal / Discount / Total` when discount > 0; otherwise unchanged.
- `auto_create_invoice_on_lock` DB trigger: copy discount fields from booking → invoice (amend in same migration).
- Receipt rendering pulls discount fields from invoice.

## 5. Approval workflow

- New `src/pages/admin/AdminDiscountApprovals.tsx` listing bookings with `discount_approval_status='pending'`. Approve / Reject buttons (admin + super_admin).
- Sidebar link in `AdminLayout`.
- `AdminBookings` row badge "Discount pending" when applicable; block status transitions while pending.

## 6. CRM + reporting

- `AdminClientProfile`: new "Discounts" summary (total received, last date, count) using `bookings.discount_amount`.
- `AdminAnalytics` / `ErpReports`: new "Discounts granted" tile + breakdown by salesperson and date range (simple aggregations on `bookings`).

## 7. Safety checks

- Existing rows have `discount_amount=0` default → all current totals unchanged.
- Commission still calculated on final (post-discount) price — already the booking `price`.
- No anon access; new admin pages reuse existing role guards.

## Files

Created: `src/lib/discounts.ts`, `src/components/booking/DiscountSection.tsx`, `src/pages/admin/AdminDiscountApprovals.tsx`, 1 migration.
Edited: both booking pages, `autoDocuments.ts`, `quotationPdf.ts`, `documentPdf.ts`, `serviceCertificates.ts`, `AdminLayout.tsx`, `AdminBookings.tsx`, `AdminClientProfile.tsx`, `ErpReports.tsx`, `App.tsx`.
