# Smart Booking Engine — Product and Technical Blueprint

Status: approved design direction; implementation in progress  
Working branch: `smart-booking`  
Scope: existing Concept Cleaning Services website and ERP  
Production: no production deployment without explicit approval

## 1. Product objective

Turn the existing Booking Engine into a guided, conversion-focused sales journey that helps customers select the right services, understand the value, add relevant services, submit booking or quotation requests, and resume saved progress.

Business targets supplied by the owner:
- 20–30 bookings per month.
- KSh 100,000–200,000 monthly revenue.

These are targets, not guaranteed outcomes. Performance must be measured using completed jobs and collected revenue, not only page views or submitted enquiries.

## 2. Non-negotiable architecture rules

1. Extend the existing Booking Engine and ERP; do not create a parallel booking, CRM, quotation, invoice or payment system.
2. The existing `services` database table is the only source of selectable services and service pricing.
3. Promotion packages are compositions of existing service records. Store service IDs/references, never duplicate service names, service catalogues, category lists or base prices in promotion configuration.
4. The authoritative category source is `service_categories`; service-category relationships must use `services.category_id` and the category relationship. Do not introduce new dependencies on legacy `services.category`.
5. Service discovery and selected-service details display the service image, using the existing `image_url` and approved category image fallback.
6. Add-on recommendations, complimentary-service explanations and sponsored promotion cards/pop-ups are text-only. They must not display images.
7. Prices and promotion eligibility must be validated by a trusted server-side path before a request is accepted. Client-side totals are indicative only.
8. A submitted request is not a confirmed appointment. Existing staff confirmation and ERP workflows remain authoritative.
9. Mobile and desktop are both first-class supported layouts.
10. Do not alter Supabase, database migrations, Edge Functions, RLS or production data without separate explicit approval.

## 3. Customer booking journey

### Stage A — Discover services
- Keep the Booking Engine embedded on the existing landing page.
- Search and browse active services from the database.
- Show service images, names, useful descriptions and database-derived indicative prices.
- Keep category navigation database-driven using `service_categories`.
- If a visitor cannot find a service, provide a clear enquiry route rather than a dead end.

### Stage B — Select a service
- Display the selected service image, name, description, relevant features and available pricing information.
- Ask only the questions relevant to that service's configured requirements.
- Preserve the existing booking/quotation hand-off and customer authentication rules.

### Stage C — Relevant add-ons and promotions
- Evaluate active, eligible promotions against the selected database service and customer selections.
- Offer relevant paid add-ons and conditional complimentary services.
- Clearly explain why an offer is recommended, what the additional service includes, its price, the free reward and all qualification conditions.
- Text-only cards/pop-ups; no images.
- Acceptance is optional. Declining must not block or degrade the original booking journey.
- Recalculate eligibility whenever the customer changes or removes a qualifying service.
- Do not recommend a service already included in the selected package or duplicate a service line.
- Never invent availability, savings, standard prices or discounts.

### Stage D — Booking details and summary
- Collect the details needed for the selected service, location and preferred schedule.
- Show an itemized summary: main service, paid add-ons, discounts, complimentary services, conditions and indicative total.
- Distinguish estimates from confirmed prices and appointment availability.
- Preserve the existing request submission and CRM/quotation/booking workflow.

### Stage E — Submit and hand off
- Submit through the existing secure workflow.
- Retain promotion attribution and a snapshot of the accepted promotion terms and pricing with the request/booking once the approved data model supports it.
- Do not create duplicate requests when a customer resumes or retries.
- Clearly state that the team must confirm the request.

## 4. Promotion management dashboard

Add a dedicated Promotions & Sales area within the existing admin ERP.

Administrators should be able to create, edit, duplicate, schedule, pause, expire and archive promotions.

Each promotion should support:
- Internal name and public headline.
- Detailed description and customer-facing explanation.
- Draft, scheduled, active, paused, expired and archived states.
- Start/end dates and timezone-aware activation.
- Eligible main service IDs selected from active database services.
- Required paid add-on service IDs selected from active database services.
- Complimentary service IDs selected from active database services.
- Fixed bundle price, add-on price, fixed discount or percentage discount where supported.
- Minimum spend and other qualifying conditions.
- Property/service eligibility rules where the existing service data supports them.
- Redemption limits and combination/stacking rules.
- Public terms, exclusions and qualifying instructions.
- Display placements and frequency controls.
- Campaign slug and trackable source/channel parameters.
- Created/updated by, timestamps and audit history.

Service pickers must query the live `services` table and display joined `service_categories` data. Only service IDs are stored in promotion composition. Names, descriptions, images and standard prices are resolved from current service records. If a referenced service is deactivated or deleted, affected promotions must be flagged for review and must not silently offer an invalid service.

Promotion pricing must define precedence and stacking explicitly. The same discount must never be applied twice. A complimentary service must be represented as a zero-charge reward with a recorded reason, not as a fabricated or altered service price.

## 5. Sponsored offers and soft pop-ups

Sponsored offers are managed from the Promotions Dashboard; they are not hardcoded campaigns.

Support placements such as:
- After the customer selects a main service.
- After relevant service details are entered.
- During the optional add-on stage.
- In the booking summary, before submission.
- On an offer-specific landing page.

Each placement should be context-aware and frequency-capped. Show one primary recommendation at a time, allow dismissal, avoid repeating dismissed offers, and never interrupt form validation, submission, authentication or payment.

Sponsored and add-on content must be text-only and sufficiently detailed:
- Clear headline.
- Why it is relevant.
- Service scope and inclusions.
- Additional amount, if any.
- Complimentary reward and how to qualify.
- Exclusions, limitations and terms.
- Clear accept/decline or explore/continue actions.

The customer must always be able to continue with the originally selected service.

## 6. Shareable promotion links and marketing tools

Each published promotion should have a stable public landing URL, for example `/offers/{campaign-slug}`.

The page should resolve the promotion dynamically, show its current eligibility and terms, preselect the qualifying service where valid, and guide the customer into the existing Booking Engine flow.

Admin marketing tools should support:
- Copy link.
- WhatsApp share text.
- Social captions for Facebook, Instagram, TikTok and other configured channels.
- Downloadable text-led poster/campaign creative where implemented.
- QR code.
- Separate UTM/source links per channel.

Track visits, offer views, clicks, booking starts, accepted add-ons, submitted requests, confirmed bookings, completed jobs and collected revenue. Do not label a click or request as revenue.

## 7. Saved progress and recovery policy

Owner-approved recovery policy: **save progress only; follow-up is manual and consent-based.**

- Automatically save anonymous and identified visitor progress locally so the customer can resume on the same browser/device.
- Save service IDs, selections, booking stage, non-sensitive configuration and promotion reference. Minimize personal data stored in browser storage; do not store passwords, payment data or authentication tokens.
- Apply an expiry period and provide a clear way to discard saved progress.
- Do not automatically send abandoned-booking messages.
- Do not create an admin lead from an anonymous browser-only session.
- Where a customer submits contact details and the system has a lawful, approved basis to retain the enquiry, staff may review and manually follow up.
- Record marketing consent separately from necessary booking-related communications, including timestamp and channel.
- Promotional WhatsApp or other marketing follow-up requires explicit consent. Marketing consent must not be a condition of receiving a quote or submitting a booking.
- Provide a withdrawal/opt-out path and respect it across future campaigns.
- Distinguish anonymous saved sessions, identified incomplete enquiries, submitted requests, confirmed bookings, completed jobs and paid jobs in reporting.

The admin recovery dashboard must only show records actually persisted to an approved backend. Browser-local anonymous sessions are not visible to administrators unless a separately approved privacy-conscious backend save mechanism is implemented.

## 8. Admin permissions and governance

- Reuse the existing ERP authentication and authorization model.
- Separate promotion draft/edit permissions from publish/pause permissions.
- Restrict campaign publishing and changes to authorized roles.
- Audit material changes to promotion conditions, pricing, dates, status and marketing content.
- Never let an unauthorized public client write directly to privileged promotion configuration.
- Public reads should expose only published, currently eligible promotion content.

## 9. Measurement

Dashboard metrics should distinguish:
- Promotion impressions/views.
- Promotion clicks.
- Booking starts.
- Add-on acceptance rate.
- Submitted requests.
- Confirmed bookings.
- Completed jobs.
- Collected revenue.
- Direct fulfilment cost of complimentary services and discounts.
- Net contribution / campaign profitability where cost data is available.
- Conversion by promotion, service, campaign source and channel.

Do not present illustrative/demo figures as actual business metrics. Empty states must be honest.

## 10. Integration boundaries

Reuse:
- Existing `services` and `service_categories` catalogue.
- Existing service image and pricing utilities where correct.
- Existing Booking Engine component and landing-page placement.
- Existing guest service request submission and staff Guest Requests workflow.
- Existing CRM leads and activities.
- Existing quotation, booking, job and payment records.

Do not change:
- Existing customer authentication requirements.
- Existing booking confirmation rules.
- Existing accounting, payment, invoice or approval calculations.
- Existing staff/admin workflows outside the approved Smart Booking scope.
- Existing production data or Supabase configuration without approval.

## 11. Implementation phases

### Phase 1 — Existing journey foundation
- Audit all Booking Engine routes, request submission, service detail hand-off and mobile layouts.
- Display service images during service search/browsing and on the selected service.
- Add privacy-conscious local progress save/resume.
- Preserve existing booking and quotation submission.

### Phase 2 — Data model and secure promotion engine
Requires separate owner approval before any Supabase work:
- Promotion records and service-composition records referencing service IDs.
- Eligibility/condition and placement configuration.
- Published promotion read path and trusted server-side validation.
- Immutable promotion/price snapshot on submitted requests.
- RLS, role checks, audit logging and safe public share links.

### Phase 3 — Promotions Dashboard and shareable campaigns
- Build admin promotion management.
- Add shareable landing pages and campaign attribution.
- Add text-only sponsored placements and detailed add-on explanations.

### Phase 4 — Recovery, reporting and optimization
- Implement approved persisted identified-enquiry recovery if authorized.
- Keep manual follow-up and consent policy.
- Connect promotion attribution to CRM, bookings, completed jobs and payments.
- Add reliable performance and contribution reporting.

## 12. Current implementation status

- Working branch: `smart-booking`; continue on this branch and do not create a parallel branch.
- Customer-facing work includes guided service discovery, selected-service details, package and add-on selection, guest submission, privacy-conscious local progress, and request confirmation.
- Guest submission now carries structured answers, quantity/measurement inputs, selected catalogue IDs, service configuration version and selected package/add-on update timestamps. If a package, add-on or service setup changes before staff conversion, the server rejects the stale selection rather than silently applying a new price. It does not send client-calculated prices as authoritative data.
- Guest submissions are designed to enter the existing native Smart Booking request tables through an admin-controlled conversion. The migration validates the current service configuration, conditional questions, scope selections, package/add-on eligibility and trusted server-side pricing before creating the native request.
- Staff then use the existing Smart Booking review, pricing, quotation and ERP booking workflow. Guest confirmation is recorded by authorized staff after WhatsApp/phone/email/in-person confirmation; the guest does not receive an ERP account or document-download access.
- The guest-to-ERP bridge, request/quotation linkage and staff confirmation actions are implemented as repository migration/Edge Function/frontend changes only. They have not been applied to live Supabase, and no Edge Function has been deployed.
- Package and add-on prices are always recalculated from the current trusted configuration during staff conversion. The initial guest catalogue estimate remains indicative until that review.
- Required guest photos are flagged for staff follow-up; authorized staff can attach the collected photos in the native Smart Booking request, and the ERP conversion function blocks booking creation until the configured photo minimum is met.
- Remaining release verification: apply the migration and Edge Function in a controlled non-production environment, test the complete guest → Smart Booking → quotation/confirmation → ERP booking path, run Supabase security/performance advisors, and then obtain explicit production approval.
- Production deployment, merge to `main`, live database changes and unrelated ERP/HR work remain outside this implementation step.
