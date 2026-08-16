# Concept cleaning services 

Create a professional, mobile-first referral and booking app for a cleaning business in Nairobi with the following features:

1. **User Roles**
   - **Client:** Book services, pay, and track booking status.
   - **Agent:** Sign up (Full Name, M-Pesa Number, Email, Town/Estate, Password, Referral Code optional), request approval from admin, book services on behalf of clients, earn tiered commission, see dashboard, and request payouts once every 7 days.
   - **Admin / Super Admin:** Manage agents, bookings, commissions, payouts, services, and reports. Multiple admins supported with role-based access.

2. **Agent Booking Form**
   - Fields: Client Name, Phone Number, Location, Service Type (dropdown), Service Date.
   - Price Adjustment: Agents can **increase price above system base price**, but cannot go below.
   - Commission and bonus calculation visible after booking.

3. **Commission System**
   - **Tiered Commissions:**
     - Bronze: 5% (0–49,999 Ksh)
     - Silver: 7.5% (50,000–99,999 Ksh)
     - Gold: 10% (100,000+ Ksh)
   - **High-Value Booking Bonus:** +1,000 Ksh for bookings ≥ 20,000 Ksh.
   - Automatically updates agent tier after cumulative sales thresholds are reached.

4. **Commission Withdrawal**
   - Agents can request payouts **once every 7 days**.
   - Admin approves payout; ledger automatically updated.
   - Agent dashboard shows available balance, last request date, and next eligible request date.

5. **Admin Dashboard**
   - Modules: Overview/Summary, Bookings Management, Agents Management, Commission & Wallet Ledger, Payout Management, Services Management, Analytics/Reports.
   - Approve/reject agents, suspend/activate agents.
   - Track commissions, high-value bonuses, tier progress, and payouts.
   - Support multiple admins with role-based access and audit logs.

6. **Additional Features**
   - Agent signup requires Town/Estate to track location.
   - Admin receives notifications of pending agent approvals and payout requests.
   - Visual progress for agents toward next tier and high-value booking goals.
   - **App Install Prompt:** When someone clicks the referral or booking link, they should be prompted to install the app before proceeding.
   - Clean, professional, intuitive UI suitable for Nairobi market.

Build the app with **mobile-first responsive design**, **easy navigation**, **secure login**, **automated commission calculations**, and **real-time dashboards** for both agents and admins showing booking history, earnings, tier status, and next-tier progress.

This project is a mobile-first cleaning services marketplace and ERP for Concept Cleaning Services.

**Live app**: https://www.conceptcleaningservices.co.ke




## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
