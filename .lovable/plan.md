
# CleanBook Nairobi — Referral & Booking App

## Overview
A mobile-first professional cleaning business app for Nairobi with three roles: **Agent**, **Admin/Super Admin**, and (future) Client. Agents sign up, get approved, book cleaning services for clients, earn tiered commissions, and request weekly payouts. Admins manage everything from a powerful dashboard. Payments are tracked manually by admin for now. Backend powered by Lovable Cloud (Supabase).

---

## 1. Authentication & Onboarding

- **Login page** with email + password (shared for agents and admins)
- **Agent signup form**: Full Name, Email, Phone (M-Pesa Number), Town/Estate, Password, optional Referral Code
- After signup, agent sees a "Pending Approval" screen until admin approves
- Admins are seeded / created by Super Admin — no public admin signup
- **PWA install prompt** shown when users visit via referral/booking link

## 2. Agent Dashboard

- **Overview cards**: Available balance, current tier (Bronze/Silver/Gold), total earnings, next payout eligibility date
- **Visual tier progress bar** showing cumulative sales toward next tier threshold
- **Recent bookings list** with status indicators (Pending, Confirmed, Completed, Cancelled)
- **Create Booking button** prominently placed
- **Payout request button** (enabled only if 7+ days since last request), showing countdown timer if not yet eligible

## 3. Agent Booking Form

- Fields: Client Name, Client Phone, Location, Service Type (dropdown from admin-managed list), Service Date (date picker)
- **Price field** pre-filled with base price from selected service; agent can increase but not decrease
- Live preview of: final price, commission amount (based on current tier %), and high-value bonus (+1,000 Ksh if booking ≥ 20,000 Ksh)
- Submit creates booking with "Pending" status

## 4. Commission System (Automated)

- **Tier thresholds** (cumulative completed booking revenue):
  - Bronze: 0–49,999 Ksh → 5%
  - Silver: 50,000–99,999 Ksh → 7.5%
  - Gold: 100,000+ Ksh → 10%
- **High-value bonus**: +1,000 Ksh automatically added for any single booking ≥ 20,000 Ksh
- Tier automatically recalculated when a booking is marked "Completed" by admin
- Commission credited to agent's wallet balance upon booking completion

## 5. Payout System

- Agent requests payout of available balance (full or partial)
- Enforced 7-day cooldown between requests
- Admin sees payout requests queue → Approve or Reject
- On approval, agent wallet balance deducted and ledger entry recorded
- Agent dashboard shows: last payout date, next eligible date, payout history

## 6. Admin Dashboard

Seven modules accessible via sidebar navigation:

1. **Overview/Summary**: Total bookings, revenue, active agents, pending approvals, pending payouts — with summary charts
2. **Bookings Management**: List/filter all bookings, update status (Pending → Confirmed → Completed / Cancelled), view booking details
3. **Agents Management**: View all agents, approve/reject new signups, suspend/activate agents, view agent details (tier, earnings, location)
4. **Commission & Wallet Ledger**: Full ledger of all commission credits and payout debits per agent, filterable by date/agent
5. **Payout Management**: Queue of pending payout requests, approve/reject with notes, payout history
6. **Services Management**: CRUD for service types (name, description, base price), enable/disable services
7. **Analytics/Reports**: Revenue over time, bookings by service type, top agents, tier distribution charts

## 7. Role-Based Access & Security

- **Super Admin** can create/manage other admins
- **Admin** has full operational access
- **Agent** sees only their own data
- User roles stored in a separate `user_roles` table with RLS policies
- Audit log table tracking key admin actions (approvals, status changes, payouts)

## 8. Database Structure (Lovable Cloud / Supabase)

Key tables:
- `profiles` — user profile info (name, phone, town/estate, M-Pesa number)
- `user_roles` — role assignments (agent, admin, super_admin)
- `services` — cleaning service catalog with base prices
- `bookings` — all booking records with agent, client info, service, price, status
- `commissions` — commission entries per completed booking
- `wallet_ledger` — credit/debit entries per agent
- `payout_requests` — payout request records with status and dates
- `audit_logs` — admin action tracking

## 9. Notifications

- Admin dashboard shows badge counts for: pending agent approvals, pending payout requests
- Toast notifications on key actions (booking created, payout approved, etc.)

## 10. Design & UX

- Mobile-first responsive design with clean, professional look
- Green/teal accent color scheme (professional cleaning brand feel)
- Bottom navigation on mobile for agents, sidebar navigation on desktop for admins
- Card-based layouts with clear status badges and progress indicators
- Optimized for the Nairobi market — simple, fast, intuitive
