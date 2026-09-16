import { Link } from 'react-router-dom';

export default function TermsAndConditions() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14">
      <div className="mb-8">
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          ← Back to Concept Cleaning Services
        </Link>
      </div>

      <article className="prose prose-slate max-w-none">
        <h1>Terms & Conditions</h1>
        <p className="text-muted-foreground">Last updated: September 16, 2026</p>

        <h2>1. Introduction</h2>
        <p>
          These Terms & Conditions govern the use of the Concept Cleaning Services website,
          customer marketplace, and services. By using our website or requesting our services,
          you agree to these terms.
        </p>

        <h2>2. Services</h2>
        <p>
          Concept Cleaning Services provides cleaning and fumigation/pest-control services
          according to the service description, quotation, booking details, and other
          information communicated to the customer.
        </p>

        <h2>3. Customer Bookings</h2>
        <p>
          Customers are responsible for providing accurate contact details, location,
          property information, requested services, and preferred service dates.
        </p>

        <h2>4. Quotations and Pricing</h2>
        <p>
          Quotations are based on the information available when they are prepared. Final
          pricing may depend on the scope of work, quantities, property conditions, and any
          additional work agreed with the customer.
        </p>

        <h2>5. Service Confirmation</h2>
        <p>
          A booking becomes confirmed according to the confirmation process communicated by
          Concept Cleaning Services. Customers should ensure that the agreed date, time,
          location, and services are correct before the service begins.
        </p>

        <h2>6. Customer Responsibilities</h2>
        <p>
          Customers must provide reasonable access to the premises and disclose information
          that may affect safe and effective delivery of the requested service.
        </p>

        <h2>7. Cleaning Preparation</h2>
        <p>
          Customers may be required to prepare areas before cleaning. Where preparation
          requirements are communicated, failure to complete them may affect the scope or
          timing of the service.
        </p>

        <h2>8. Fumigation and Pest-Control Safety</h2>
        <p>
          Customers must follow safety instructions provided for fumigation or pest-control
          services, including instructions concerning people, children, pets, food, ventilation,
          re-entry, and preparation of the treated area.
        </p>

        <h2>9. Service Limitations</h2>
        <p>
          Cleaning and pest-control results can depend on the condition of the property,
          materials, level of contamination or infestation, access, environmental conditions,
          and other circumstances outside the service provider's control.
        </p>

        <h2>10. Rescheduling and Cancellation</h2>
        <p>
          Customers should contact Concept Cleaning Services as early as possible when they
          need to change or cancel a booking. Any applicable charges or revised arrangements
          will depend on the circumstances and the agreed service terms.
        </p>

        <h2>11. Payment</h2>
        <p>
          Customers are responsible for payment of agreed charges according to the payment
          terms communicated in the quotation, invoice, booking, or other written agreement.
        </p>

        <h2>12. Invoices and Receipts</h2>
        <p>
          Where applicable, invoices and receipts may be provided electronically through the
          customer service system or through other agreed communication channels.
        </p>

        <h2>13. Service Completion</h2>
        <p>
          Customers should raise concerns about the delivered service as soon as reasonably
          possible so that the matter can be reviewed and addressed.
        </p>

        <h2>14. Customer Complaints and Support</h2>
        <p>
          Customers may contact Concept Cleaning Services through the support and contact
          channels published on our website regarding bookings, services, payments, or other
          concerns.
        </p>

        <h2>15. Customer Accounts</h2>
        <p>
          Customers are responsible for maintaining the confidentiality of their account
          credentials and for providing accurate information when using the customer portal.
        </p>

        <h2>16. Google Sign-In</h2>
        <p>
          Customers may be able to access their account using Google authentication where
          this option is available. Use of Google authentication is also subject to Google's
          applicable terms and policies.
        </p>

        <h2>17. Website Use</h2>
        <p>
          Customers must not misuse the website, attempt unauthorized access, interfere with
          its operation, or use the website for unlawful purposes.
        </p>

        <h2>18. Intellectual Property</h2>
        <p>
          Website content, branding, graphics, text, and other materials belonging to Concept
          Cleaning Services may not be reproduced or used commercially without permission.
        </p>

        <h2>19. Liability</h2>
        <p>
          Concept Cleaning Services will provide services with reasonable care and according
          to the agreed scope. Nothing in these Terms is intended to exclude rights or
          protections that cannot lawfully be excluded under applicable law.
        </p>

        <h2>20. Refunds</h2>
        <p>
          Any refund request will be considered based on the circumstances of the booking,
          payment, and service provided, together with any applicable agreement or legal
          requirements.
        </p>

        <h2>21. Changes to These Terms</h2>
        <p>
          We may update these Terms & Conditions from time to time. The current version will
          be published on this page with a revised update date.
        </p>

        <h2>22. Governing Law</h2>
        <p>
          These Terms are intended to operate in accordance with the applicable laws of Kenya.
        </p>

        <h2>23. Contact Us</h2>
        <p>
          For questions regarding these Terms or our services, please contact Concept Cleaning
          Services using the contact information published on our website.
        </p>

        <p className="mt-8">
          <Link to="/privacy-policy" className="text-primary hover:underline">
            View Privacy Policy
          </Link>
        </p>
      </article>
    </div>
  );
}
