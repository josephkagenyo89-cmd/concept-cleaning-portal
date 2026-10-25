# Concept Cleaning Services — Accounting System Specification

## Purpose

Build a Zoho Books-style, double-entry accounting system inside the existing ERP. This specification does not authorize applying migrations to production or automatically posting historical records.

## Design principles

- Keep the existing CRM, client records, quotations, bookings, invoices, income records, expenses, payroll, commissions, and document workflows as the operational source records. Do not create duplicate customer or invoice masters.
- Keep petty cash as a cashbook and workflow inside the existing Expenses module, not a separate duplicate navigation module.
- The general ledger is the accounting source of truth after a controlled, reconciled posting process is implemented.
- Use Kenyan shillings (KES) as the initial base currency. Design for future multi-currency without silently converting historical amounts.
- Keep VAT disabled on customer invoices unless the business confirms its registration and applicable tax treatment. Do not interpret “not charging VAT” as exemption from other tax-invoicing obligations.
- Never silently delete or overwrite posted financial history. Corrections must use reversal/adjustment entries with references, reasons, timestamps, and user attribution.
- All financial reports must disclose their basis, period, and whether they are ledger-based or interim operational summaries.
- Never claim legal or standards compliance until a qualified Kenyan accountant has reviewed configuration, mappings, reporting, and the business's actual obligations.

## Core navigation

1. Finance dashboard
2. Invoices and receivables
3. Customer payments and allocations
4. Income receipts
5. Expenses and supplier bills (including petty-cash funds, vouchers, and cashbook)
6. Bank, cash, and M-Pesa accounts
7. Bank/M-Pesa reconciliation
8. Chart of accounts
9. Journal entries and general ledger
10. Accounting periods and close checklist
11. Payroll journals
12. Fixed assets and depreciation
13. Tax and eTIMS readiness
14. Financial statements and exports
15. Audit trail and accounting settings

## Invoice tracking

- Search by invoice number, client name, phone, service, date, and reference.
- Filter paid, unpaid, partially paid, pending approval, overdue, cancelled, and date ranges.
- Show invoice date, due date, original amount, amount allocated, balance due, last payment, and days overdue.
- Track full and partial payments as separate allocations; never mark an invoice fully paid merely because a payment was submitted for approval.
- Provide customer statements, aging buckets, payment reminders, receipts, credit notes, and a clear history of status changes.
- Keep operational invoice status distinct from payment approval status and accounting posting status.

## Double-entry ledger

- Chart of accounts with codes, types, parent accounts, control accounts, active status, and descriptions.
- Journal headers and lines with unique numbering, date, reference, source record, period, creator, approver/poster, and narrative.
- Enforce equal non-zero debits and credits, open-period posting, active accounts, source idempotency, and immutable posted journals.
- Draft, review, post, reverse, and period-close controls; separate permissions for preparer, approver, accountant, and administrator where practical.
- Period locks, audit logs, supporting-document links, and exported audit schedules.
- No automated posting to existing records until source mappings and historical reconciliation have been approved.

## Receivables, payables, and cash

- Customer receivables and supplier payables subledgers reconciled to control accounts.
- Payment allocation across one or more invoices; overpayments and customer advances recorded as liabilities until allocated or refunded.
- Supplier bills, due dates, supplier statements, partial settlements, and expense approvals.
- Separate cash-on-hand, business bank, M-Pesa clearing, and petty-cash fund balances.
- Bank statement imports, matching rules, unmatched transaction queues, duplicate detection, reconciliation reports, and a locked reconciliation period.
- M-Pesa references and bank references with duplicate checks; do not require an M-Pesa code for cash or bank payments.
- Petty cash: multiple named funds, opening balances, cash replenishments, cash returned, expenses with vouchers/receipt references, derived balances, and prevention of spending below the available balance.
- Petty-cash expenses must create one linked row in the existing expense register and one cashbook movement atomically; do not duplicate the expense in reports.
- Keep fund movement history read-only to ordinary client-side writes; corrections should be controlled and auditable.

## Expenses, payroll, and assets

- Extend the existing expense register rather than creating a second expense module or separate expense master.
- Capture category, supplier/payee, receipt/voucher reference, optional supporting-document URL, payment method, business purpose, and approval/payment attribution.
- The first UI increment records expenses through the existing admin workflow; a full preparer/approver separation, receipt upload/storage, supplier bills, and ledger posting still need implementation.
- Payroll posting from approved payroll runs, with gross pay, deductions, employer costs, and payable balances mapped explicitly; do not alter the existing payroll calculation workflow.
- Fixed-asset register, acquisition cost/date, asset category, useful life, residual value, depreciation method, accumulated depreciation, disposal, and gain/loss.
- Agent commissions and wallet balances reconciled separately; avoid double-counting wallet movements as business expenses or income.

## Reports and accountant tools

- Trial balance, general ledger, journal listing, profit and loss, balance sheet, cash flow, changes in equity, and notes where applicable.
- Accounts receivable/payable aging, customer/supplier statements, income and expense analysis, cash/bank/M-Pesa reconciliation, payroll liabilities, fixed-asset schedule, depreciation, and tax schedules.
- Period-over-period comparisons, date filters, drill-down from totals to source records, CSV/XLSX/PDF exports, and clear KES formatting.
- Reports must be generated from posted ledger entries after cutover. Existing operational summaries must be labelled as interim and must not be presented as formal accrual financial statements.

## Kenya tax and regulatory readiness

- Add configurable KRA PIN, tax registration status, invoice/eTIMS identifiers, transmission status, error messages, and reconciliation exports only after the business's onboarding route and credentials are confirmed.
- Keep VAT configuration off by default based on the owner's instruction, but make tax treatments configurable rather than hard-coded. Support relevant tax codes only after accountant confirmation.
- Support recording withholding tax and other statutory liabilities when applicable; do not infer applicability from a payment description.
- Preserve source invoices and expense evidence and provide schedules needed for tax-return preparation.
- Default accounting framework should be selected with the accountant: IFRS for SMEs may be appropriate for an eligible private SME; full IFRS or other frameworks may apply depending on the entity. IPSAS is for public-sector entities and should not be imposed on this private business merely because a government accountant may review its records.

## Security and governance

- Restrict ledger, tax configuration, period closing, and posting to authorized finance roles.
- Use server-side/database authorization; hiding UI controls alone is not security.
- Audit creates, edits, approvals, postings, reversals, exports, and configuration changes.
- Do not store bank credentials, M-Pesa credentials, KRA secrets, or API tokens in ordinary tables or client-side code.
- Use least-privilege access, safe error handling, and avoid loading finance data into public/customer routes.
- Define backups, restore testing, retention, and accountant handover/export procedures.

## Implementation sequence

1. Ledger schema and safeguards; local regression tests.
2. Read-only historical reconciliation of invoices, income, expenses, payroll, and payment references.
3. Approve opening balances and source-to-account mappings with the accountant.
4. Invoice balances, payment allocation, and receivables subledger.
5. Expense/payables, petty cash, cash/bank/M-Pesa accounts, and reconciliation.
6. Payroll journals, commissions, and fixed assets.
7. Ledger-based statements, tax/eTIMS integration, exports, permissions, and close process.
8. Accountant review, test evidence, controlled rollout, and only then production migration.

## Current implementation status

The feat/zoho-style-accounting branch contains a draft ledger foundation, a regression-test script, invoice tracking/dashboard usability changes, and an extension of the existing Expenses screen with petty-cash fund and cashbook tabs. New draft migrations add petty-cash funds, linked expense vouchers, derived balances, and database functions for atomic petty-cash expense capture. The migrations and tests have **not** been run against a database, and the frontend has **not** been built or type-checked in this environment. Existing historical records have not been posted to the ledger. Production remains untouched.