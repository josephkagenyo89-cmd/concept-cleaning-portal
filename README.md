# Concept Cleaning Services — Smart Intelligent Booking Engine

**Product specification, architecture guide and completion reference**  
**Repository:** `josephkagenyo89-cmd/concept-cleaning-portal`  
**Working branch:** `smart-booking`  
**Product owner:** Concept Cleaning Services

---

## 1. Product vision

The Smart Booking Engine is the customer acquisition, service discovery, guided booking, recommendation, package-selling and booking-intake engine for Concept Cleaning Services.

It is not intended to be a simple booking form or a chatbot. It should act like a knowledgeable digital sales consultant: understand what a customer needs, guide the customer to an appropriate service, recommend useful combinations, explain relevant offers, calculate prices using approved business rules, collect the information staff need, and pass a well-structured request into the existing Concept ERP.

### Primary business objective

**Increase completed bookings and the average revenue value of each booking (the revenue basket).**

The engine should help Concept move customers from buying one isolated service to choosing a more complete, relevant solution where it benefits the customer and the business. For example, a customer looking for sofa cleaning may also benefit from mattress cleaning and a clearly identified complimentary carpet-cleaning offer.

The engine must never pressure customers into irrelevant purchases. Recommendations should be useful, transparent, optional where appropriate and grounded in the actual service catalogue and approved commercial rules.

### What success means

The system should improve measurable business outcomes:

- More qualified booking requests and completed bookings.
- Higher average booking value and revenue per customer.
- Higher relevant add-on attachment rate.
- Higher package discovery, selection and conversion.
- Better quotation acceptance and fewer abandoned enquiries.
- More repeat bookings and better customer retention.
- Measurable return from sponsored-service campaigns.
- Less manual work caused by incomplete or poorly described requests.

These are objectives, not guaranteed results. Performance must be measured against actual booking and revenue data.

---

## 2. What makes it intelligent?

“Smart” means that the booking journey responds to context and makes explainable decisions. It does not mean adding an AI chat window without useful booking intelligence.

The intended intelligence is built in layers:

1. **Structured business rules** — approved service eligibility, questions, conditions, prices, package rules, promotion dates and service-area rules.
2. **Contextual understanding** — interpret the customer's search, selected service, answers, measurements, property type, location and stated requirements.
3. **Recommendation and ranking** — identify suitable services, packages and add-ons, then rank them by relevance and customer value.
4. **Commercial intelligence** — show the right package or offer at the right point, while protecting approved prices and minimum commercial rules.
5. **Workflow intelligence** — detect missing information, quote-required work, photo requirements and requests that need staff assessment.
6. **Performance intelligence** — measure which searches, recommendations, packages and campaigns lead to completed bookings and revenue; use those results to improve approved rules.

### Explainable, controlled intelligence

Every recommendation should have a business reason, such as:

- It complements the service the customer selected.
- The customer's answers indicate a related need.
- The selected package covers the services requested.
- The service is active, eligible and available for the customer's request.
- The offer is within its approved campaign dates.
- The customer has selected a relevant size, quantity or property type.

The engine must not invent services, prices, discounts, availability, package eligibility or guarantees.

### Role of AI

The first reliable intelligence layer should be rules-driven and data-backed. AI assistance may be added where it provides measurable value, for example interpreting free-text customer needs, summarising job requirements or explaining recommendations.

AI must not independently change service prices, create unapproved discounts, activate campaigns, promise availability, approve quotations or create confirmed ERP bookings. Those actions remain governed by deterministic server-side rules and authorised staff/customer actions.

---

## 3. How the system is built

The Smart Booking Engine is part of the existing Concept Cleaning Services application. It is not a separate CRM or a replacement ERP.

### Application and data architecture

- **Customer interface:** the existing React and TypeScript application, including the public service discovery and booking experience.
- **Application navigation and UI:** existing application routes and shared components.
- **Data and authentication:** the existing Supabase project, PostgreSQL database and Supabase Auth.
- **Booking configuration:** dedicated `booking_engine_*` configuration and request structures.
- **Secure business operations:** server-side PostgreSQL functions/RPCs and existing Supabase Edge Functions where applicable.
- **Files and evidence:** the existing booking photo-upload/storage workflow.
- **ERP integration:** existing Concept CRM clients, quotations and bookings. The booking engine must hand off to these workflows rather than create a parallel accounting or job-management system.
- **Hosting:** the existing application deployment setup. Production release remains separately approval-gated.

### Existing booking-engine data foundations

The database foundation includes the following confirmed structures:

| Structure | Responsibility |
|---|---|
| `booking_engine_service_config` | Per-service booking enablement, customer instructions, photo rules, measurement and availability configuration, and configuration version. |
| `booking_engine_questions` | Configurable questions, input types, required flags, options and display order. |
| `booking_engine_question_conditions` | Conditional question behaviour, including show/hide and required/optional rules. |
| `booking_engine_pricing_rules` | Service pricing configuration for fixed, per-unit, per-measurement, tiered and quotation pricing. |
| `booking_engine_requests` | Customer booking/enquiry request, ownership, requested date/time, location, status and ERP conversion reference. |
| `booking_engine_request_items` | Services selected for a request, answers, measurements, quantities, selected extras, scope and pricing snapshots. |
| `booking_engine_request_events` | Request timeline and recorded workflow events. |
| `booking_engine_value_offers` | Configured value offers and their commercial/display settings. |
| `booking_engine_value_offer_services` | Relationships between offer services, including trigger, included and recommended roles. |

The existing database also contains the booking photo and workflow infrastructure described in the implementation history. Exact deployed schema and migration history must be checked before any database change.

### Important offer terminology

The current offer relationship model uses:

- **Trigger:** the service that makes an offer eligible to appear in the customer's journey.
- **Included:** a service included in the configured offer.
- **Recommended:** an optional complementary service.

“Included” must not automatically be assumed to mean “free”. The offer's approved pricing configuration must determine whether an item is paid, discounted or complimentary. The customer display, server calculation, quotation and ERP line items must all agree.

### Core processing flow

1. The customer searches for or selects a service.
2. The engine loads only the relevant service and booking configuration.
3. The engine asks configured questions and applies their conditions.
4. The recommendation layer evaluates relevant complementary services and eligible offers.
5. The pricing layer calculates an estimate or identifies that a staff quotation is required.
6. The customer reviews the selected services, package terms, price information and request details.
7. The request is submitted through the appropriate authenticated or guest-safe path.
8. Staff review the request, photos, answers and pricing requirements.
9. Staff request clarification, prepare a quotation or approve the request as appropriate.
10. The customer can review and accept a prepared quotation where required.
11. The request is made ready for conversion and handed into the existing ERP booking workflow.
12. The engine records the outcome so booking, package, add-on and campaign performance can be measured.

---

## 4. Customer-side features and behaviour

### 4.1 Service discovery and search

- Search for services using natural customer wording.
- Search by service name, service code and available descriptive information.
- Rank relevant matches rather than requiring exact service-name wording.
- Browse active services and service categories.
- Show service descriptions, images and starting-price or quotation indicators where available.
- Support service deep links that restore the selected service.
- Provide a clear contact route when no suitable service is found.
- Load the catalogue when needed rather than unnecessarily loading the entire catalogue on every page visit.

### 4.2 Guided booking and adaptive questions

- Ask service-specific questions configured by authorised staff.
- Support text, number, select, multi-select, yes/no, date, time, measurement and address inputs.
- Mark required questions clearly.
- Show, hide, require or make questions optional based on configured answers.
- Collect dimensions, quantities, material, condition, property type and other relevant details where configured.
- Request photos when required or useful.
- Explain why information or photos are needed.
- Preserve the customer's answers with the request so staff do not need to ask for the same information again.

### 4.3 Intelligent recommendations

- Recommend services that genuinely complement the selected service.
- Use the customer's stated needs and answers to improve relevance.
- Suggest a package when the selected services satisfy its trigger and eligibility rules.
- Offer optional add-ons without forcing them into the request.
- Explain what each recommended service adds.
- Avoid duplicate services already present in the customer's selection.
- Avoid inactive, ineligible or expired offers.
- Allow customers to decline recommendations and continue with their original request.

### 4.4 Packages and complimentary services

- Present configured packages in the marketplace and relevant booking steps.
- Support a trigger service that starts an offer journey.
- Show required included services and optional recommended services distinctly.
- Clearly identify a complimentary service and its terms.
- Define quantity, size, property and coverage limits for complimentary items.
- Show the paid services the customer must select to qualify.
- Prevent an offer from being represented as free unless the server-side pricing configuration confirms it.
- Avoid charging twice for a service already covered by the package.
- Carry the final package composition and pricing into the quotation and ERP booking.
- Allow staff to configure and review packages before activation.

### 4.5 Sponsored services

The intended sponsored-service capability should support:

- Admin-designated sponsored listings.
- Clear “Sponsored” labelling visible to customers.
- Campaign start and end dates.
- Placement priority and display limits.
- Relevant placement in search, category and marketplace contexts.
- Automatic expiry and removal from sponsored placement.
- Impression, click, enquiry and booking attribution.
- Campaign reporting and return-on-spend analysis.

Sponsored placement must not disguise advertising as an organic recommendation. Relevance, service eligibility and customer trust remain mandatory.

### 4.6 Price and quotation experience

- Show a price estimate only when sufficient approved pricing information exists.
- Support fixed, per-unit, per-measurement, tiered and quotation-required service pricing.
- Show the basis of the estimate, quantities and relevant assumptions.
- Apply only approved promotions and discounts.
- Clearly identify when inspection or staff quotation is required.
- Explain that an estimate or submitted request is not a confirmed appointment where confirmation is still pending.
- Keep final calculation on the server; browser calculations are display assistance only.

### 4.7 Customer account and guest journeys

- Authenticated customers use their linked customer profile and the existing customer workflow.
- Guest customers use the approved guest-request path and provide the contact information required for follow-up.
- Do not send staff or agent accounts through customer-only endpoints.
- Show a request reference after successful submission.
- Allow customers to see request status and request activity where the workflow permits.
- Allow customers to respond to clarification requests.
- Allow cancellation requests through the controlled workflow.
- Allow customers to review and accept a prepared quotation where applicable.

### 4.8 Mobile and accessibility

- Mobile-first responsive booking journey.
- Desktop and tablet layouts.
- Keyboard-accessible service search and selection.
- Clear focus, validation and error states.
- Reduced-motion support.
- Readable package and pricing information.
- Avoid unnecessary page data requests and heavy initial catalogue loading.

---

## 5. ERP admin and staff-side features

The admin side should give staff control over the customer journey and a clear operational view of every request.

### 5.1 Service configuration

- Enable or disable a service for Smart Booking without changing unrelated service or ERP records.
- Configure customer instructions.
- Configure photo mode and minimum/maximum photo counts.
- Configure measurements and availability requirements.
- Configure questions, answer options, order and conditions.
- Configure pricing rules and quotation-required handling.
- Version configuration changes so the request can retain the configuration used when it was submitted.
- Validate configuration before making a service available to customers.

### 5.2 Offer and package management

- Create and edit value offers.
- Set offer title, description, terms and display order.
- Define the trigger service.
- Define required included services.
- Define optional recommended services.
- Configure approved price mode and price value.
- Configure featured placement and active dates.
- Activate or deactivate offers through authorised admin controls.
- Preview the customer-facing presentation.
- Review package eligibility and the treatment of complimentary services before activation.
- Preserve a clear distinction between a draft, an approved configuration and a live offer.

### 5.3 Sponsored campaign management

- Create and edit sponsored campaigns.
- Select eligible services.
- Set campaign schedule, placement and priority.
- Set campaign budget or commercial terms if the business model requires them.
- Preview sponsored presentation.
- Activate, pause or expire campaigns through authorised controls.
- Review impressions, clicks, enquiries, bookings and attributable revenue.
- Prevent expired or inactive services from continuing to appear as sponsored.

### 5.4 Booking request operations

- View and filter incoming requests.
- Search by request reference, customer, service and status.
- Open full request details and selected service items.
- Review customer answers, measurements, location, requested date/time and notes.
- Review uploaded photos.
- Assign requests to appropriate staff.
- Move requests through permitted statuses.
- Request missing information or clarification.
- Review customer replies and the request activity timeline.
- Reject or cancel requests with appropriate reasons.
- Identify requests requiring manual inspection or a quotation.

### 5.5 Quotation and approval operations

- Calculate request pricing using server-side pricing rules.
- Identify items that require a staff-entered quotation.
- Prepare a quotation from the request.
- Preserve the calculated or staff-approved price in a pricing snapshot.
- Prevent duplicate quotations for the same request.
- Record who prepared the quotation and when.
- Allow the customer to accept the quotation through an ownership-checked workflow.
- Apply required admin approval before conversion where the workflow calls for it.

### 5.6 ERP handoff

- Link the request to the correct CRM customer.
- Preserve the service selection, quantities, answers, scope and approved pricing.
- Expand package inclusions into the correct booking line items.
- Carry pricing snapshots into the ERP conversion.
- Create the normal existing ERP booking rather than a parallel booking record.
- Preserve request and booking references for traceability.
- Prevent duplicate conversion.
- Keep existing job, invoice, payment, receipt and certificate workflows under their existing ERP rules.

### 5.7 Management dashboard and reporting

The admin dashboard should provide actionable information, not just decorative charts.

Required measures include:

- Requests received, reviewed, quoted, accepted, converted and completed.
- Conversion rate by source, service and package.
- Average booking value and revenue per customer.
- Revenue from multi-service bookings versus single-service bookings.
- Package selection and conversion rates.
- Add-on attachment rate and revenue contribution.
- Complimentary-service cost and package contribution where cost data is available.
- Quotation turnaround and acceptance rates.
- Abandonment and no-match search trends where measurable.
- Sponsored impressions, clicks, enquiries, bookings and attributed revenue.
- Repeat booking rate and customer lifetime value where sufficient history exists.
- Service and package demand by location and time period.

Reports should support useful filters and exportable views where the existing reporting framework permits.

### 5.8 Permissions and auditability

- Customers may access only their own requests and permitted actions.
- Staff access is governed by existing roles and permissions.
- Admin-only configuration and campaign controls must not be exposed to customers.
- Sensitive operations must be validated server-side.
- Record important configuration and workflow actions with actor and timestamp.
- Keep privileged database functions restricted to authorised roles.
- Use row-level security and ownership checks consistently.
- Do not trust client-submitted prices, discounts, roles or approval states.

---

## 6. Intelligent engine components

The following logical components describe how the intelligent behaviour should work. They may be implemented as coordinated modules within the existing application and database; they do not require a separate microservice for every capability.

| Component | Responsibility | Business value |
|---|---|---|
| Service discovery | Search, match and rank services against customer wording. | Reduces friction and missed enquiries. |
| Customer context builder | Assemble selected service, answers, measurements, property and location context. | Makes recommendations relevant. |
| Guided question engine | Determine which questions are shown and which answers are required. | Improves request quality and reduces manual follow-up. |
| Recommendation engine | Rank complementary services and explain why they are relevant. | Increases useful add-on sales. |
| Package/value-offer engine | Match trigger services, qualifying combinations, included items and optional recommendations. | Increases average booking value. |
| Complimentary-service rules | Validate eligibility, limits and zero-price treatment for approved free items. | Makes offers clear and protects margins. |
| Sponsored placement engine | Place relevant paid promotions with clear disclosure and campaign controls. | Creates measurable promotional inventory. |
| Pricing engine | Calculate prices from approved server-side rules or route to quotation. | Protects price integrity and customer trust. |
| Booking assessment engine | Detect missing data, photo requirements and quote/inspection needs. | Improves operational efficiency. |
| Conversion and follow-up engine | Track incomplete journeys and permitted follow-up opportunities. | Recovers otherwise lost bookings. |
| Analytics and feedback engine | Attribute selections and outcomes to recommendations, packages and campaigns. | Shows what actually increases revenue. |
| Admin control layer | Let authorised staff configure, approve and monitor rules. | Keeps commercial decisions under business control. |

### Recommendation decision sequence

A recommendation should pass these checks before it is displayed:

1. Is the service or offer active and eligible?
2. Does it match the customer's selected service and stated need?
3. Does it fit the relevant property, quantity, measurement and location context?
4. Is the campaign or offer within its valid dates?
5. Are required services and conditions satisfied?
6. Is pricing configured and calculable, or clearly marked for quotation?
7. Is the recommendation already represented in the request?
8. Can the engine explain why it is being recommended?

Only then should the engine rank and display the candidate.

### Learning from outcomes

The system should measure recommendation impressions, selections, removals, completed bookings and revenue. Admins should be able to see which recommendations perform well and adjust rules, package contents and campaign priorities.

The system must not silently rewrite business rules or prices based on statistical patterns. Any automated optimisation that changes customer-facing commercial behaviour requires explicit limits, auditability and authorised approval.

---

## 7. Request lifecycle and ERP workflow

The existing Booking Engine request status model includes:

`draft` → `submitted` → `under_review` → `awaiting_customer` → `approved` / `quote_required` → `quote_prepared` → `customer_accepted` → `ready_for_booking` → `converted`

The workflow also supports terminal or exception states such as `rejected` and `cancelled`. Not every request follows every state; the permitted transition rules govern the actual path.

### Typical customer path

Search or discover service → select service → answer guided questions → review relevant recommendations and offers → provide booking details → submit request → respond to clarification if needed → review quotation if required → accept quotation → request becomes ready for booking.

### Typical staff path

Open request → assess scope and photos → assign owner → request clarification or approve → calculate price or prepare quotation → record approval → convert to the existing ERP booking workflow → follow the normal job and accounting processes.

A request submission is not automatically a confirmed appointment. Confirmation and ERP conversion must follow the configured approval and booking workflow.

---

## 8. Revenue-basket strategy

The engine should deliberately support growth in average booking value without relying on blanket discounts.

### Sales mechanisms

1. **Relevant cross-sell:** offer a complementary service when the selected service makes the recommendation useful.
2. **Multi-service packages:** make it easy to buy a complete solution rather than one isolated task.
3. **Complimentary-service incentive:** reward a qualifying package with a defined free service, subject to approved size and quantity limits.
4. **Optional upgrades:** allow a customer to choose a higher level or additional coverage where available.
5. **Sponsored discovery:** promote selected services to relevant customers with clear sponsored labels.
6. **Quote recovery:** collect enough information to prepare a useful quotation and follow up through permitted channels.
7. **Repeat-service prompts:** recommend relevant future services based on actual service history and approved timing rules.

### Example

A customer searches for sofa cleaning.

- The engine returns the matching sofa service.
- It asks for the sofa configuration and any other required details.
- It identifies a relevant package that combines sofa and mattress cleaning.
- It shows the complimentary carpet cleaning and its exact limits.
- The customer can select the package or continue with sofa cleaning only.
- The pricing engine calculates the paid items and the complimentary item correctly.
- The request and its package composition reach staff and the ERP without losing the offer details.

### Key commercial formulas

- **Average booking value (ABV):** total value of converted bookings ÷ number of converted bookings.
- **Add-on attachment rate:** converted bookings with at least one paid add-on ÷ converted bookings.
- **Package conversion rate:** converted bookings containing a package ÷ eligible package selections or package journeys, using a clearly defined denominator.
- **Booking conversion rate:** converted bookings ÷ qualified submitted requests.
- **Sponsored return:** attributable gross profit or revenue, reported separately and consistently, compared with campaign spend.

The dashboard must define each denominator consistently. Do not report clicks or request submissions as completed revenue.

### Margin protection

A free service is not cost-free to Concept. Package design should account for labour, transport, supplies, service duration and the cost of the complimentary item. Where reliable cost data is unavailable, the engine must not invent a margin or claim a package is profitable. Admins must approve offer terms and price treatment before activation.

---

## 9. Data, security and reliability principles

- Use the existing service catalogue as the source of service identity and availability.
- Do not invent category mappings or duplicate service records.
- Fetch only the data required for the current page and booking step.
- Validate service eligibility and price on the server.
- Preserve pricing and configuration snapshots for submitted requests.
- Validate customer ownership on every customer action.
- Enforce admin permissions for staff-only actions.
- Keep privileged functions protected and use a pinned search path for security-definer functions.
- Use safe, idempotent operations for quotation preparation and ERP conversion.
- Validate photo types, sizes, ownership and storage access.
- Record request events for traceability.
- Handle network failure and duplicate submissions without silently losing customer information.
- Avoid creating duplicate customers, quotations or ERP bookings.
- Respect tracking consent for marketing pixels and attribution.
- Do not expose internal ERP, HR, accounting or unrelated customer data to public marketplace pages.

---

## 10. Feature inventory and implementation status

This README defines the intended product. It is not a declaration that every feature below is already implemented or production-ready.

### Existing implementation foundations recorded on the Smart Booking work

The branch and development notes show implementation work for:

- Public service search and ranked service matching.
- Lazy loading of the service catalogue in the landing-page booking widget.
- Service category browsing.
- Customer service selection and booking details.
- Authenticated customer and guest request paths.
- Configurable service booking setup.
- Conditional booking questions.
- Server-side pricing functions and pricing snapshots.
- Fixed, per-unit, per-measurement, tiered and quotation pricing foundations.
- Value-offer trigger, included and recommended relationships.
- Package marketplace and package selection work.
- Request activity and status history.
- Customer clarification replies and cancellation.
- Staff request assignment and photo review.
- Staff quotation preparation and customer quotation acceptance.
- ERP conversion workflow and booking linkage.
- Security controls for customer ownership and administrator actions.

The November implementation notes also record a coordinated Smart Booking commit and applied workflow migrations. Migration history still requires reconciliation before further database migration work. A safe staging environment is required for full end-to-end verification without creating test records in live customer data.

### Capabilities that must be completed or explicitly verified

- A complete contextual recommendation engine across the customer journey.
- Package selection that carries confirmed inclusions, complimentary items and correct pricing all the way into quotation and ERP conversion.
- Clear and enforceable complimentary-service eligibility and limits.
- Sponsored-service campaign administration, placement and attribution.
- Complete admin configuration and approval experience for the intelligent features.
- Conversion, package, add-on and sponsored-campaign analytics.
- Controlled follow-up and abandoned-enquiry recovery.
- Recommendation feedback and performance-based rule improvement.
- Complete integration verification across customer, staff, quotation and ERP workflows.
- Final security, responsive design, accessibility and performance review.

A feature must be marked **Built** only after its implementation is inspected and its intended workflow is complete. A design described in this document is **Planned** until implemented. A feature with code present but incomplete integration is **In progress**, not complete.

---

## 11. Build completion and release gates

The agreed delivery order is:

1. Finalise the complete feature specification.
2. Inspect the existing implementation and preserve working functionality.
3. Implement all agreed customer-side capabilities.
4. Implement all agreed admin and ERP-side capabilities.
5. Complete recommendation, package, sponsored-service and conversion intelligence.
6. Complete all integration and workflow handoffs.
7. Reconcile migration history safely; do not reapply migrations blindly.
8. Confirm the build is feature-complete against this document.
9. Only then begin formal end-to-end, regression, security, accessibility and responsive testing.
10. Present the complete product for owner review and approval.
11. Deploy to production only after explicit approval.

### Project safeguards

- Work on the existing `smart-booking` branch.
- Do not create additional branches.
- Do not merge into `main` without explicit approval.
- Do not deploy to production without explicit approval.
- Do not create test bookings or test records in the live customer database.
- Do not redesign the database or modify unrelated ERP modules.
- Do not change existing accounting, payment, invoice or approval rules as part of Smart Booking unless separately approved.
- Keep commits and preview deployments to the agreed minimum.
- Preserve existing customer records and completed functionality.

---

## 12. Definition of done

The Smart Booking Engine is complete only when all of the following are true:

- A customer can discover and select a relevant service.
- The guided journey asks the right configured questions and captures the required scope.
- Relevant recommendations and packages are presented accurately and transparently.
- Paid, included, discounted and complimentary items are distinguished correctly.
- All prices are validated server-side.
- Sponsored services can be administered, labelled, scheduled and measured if included in the approved release scope.
- Customer requests, photos, clarifications and status history work end to end.
- Staff can review, assign, quote and approve requests using the correct permissions.
- Accepted requests convert into the existing ERP booking workflow without data or price loss.
- The engine measures booking conversion, average booking value, add-on/package performance and campaign results.
- The experience is complete on mobile and desktop.
- Security, migration history and data access are understood and safe.
- All agreed features are implemented before formal testing begins.
- The owner has reviewed and approved the release.

---

## 13. Product principle

**Smart Booking should behave like Concept Cleaning Services' best digital sales consultant and booking coordinator: it understands the customer's needs, recommends the right solution, increases the value of a booking through relevant packages and add-ons, protects pricing integrity, and gives the ERP team everything needed to fulfil the work professionally.**

The measure of intelligence is not how many AI features the system claims to have. It is whether customers make better decisions, more enquiries become completed bookings, average booking value increases, staff spend less time chasing missing information, and Concept can clearly measure the revenue impact.
