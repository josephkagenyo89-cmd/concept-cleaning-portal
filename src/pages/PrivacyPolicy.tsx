import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-6 md:py-14">
      <div className="mb-8">
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          ← Back to Concept Cleaning Services
        </Link>
      </div>

      <article className="prose prose-slate max-w-none">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: September 16, 2026</p>

        <h2>1. Introduction</h2>
        <p>
          Concept Cleaning Services respects your privacy and is committed to handling
          customer information responsibly. This Privacy Policy explains what information
          we collect, how we use it, and how customers can contact us about their information.
        </p>

        <h2>2. Information We Collect</h2>
        <p>
          Depending on how you use our website and services, we may collect information such
          as your name, email address, phone number, WhatsApp number, location, booking details,
          service requests, quotations, invoices, payment-related information, and messages
          or notes that you provide to us.
        </p>

        <h2>3. Customer Accounts</h2>
        <p>
          When you create a customer account, we use the information you provide to create
          and manage your account and to provide customer services through our website.
        </p>

        <h2>4. Google Sign-In</h2>
        <p>
          If you choose to sign in using Google, authentication is handled through Google's
          authentication services. We receive information made available to us through that
          authentication process and use it to create or access your Concept Cleaning Services
          customer account.
        </p>

        <h2>5. How We Use Information</h2>
        <p>
          We may use customer information to provide and manage cleaning and fumigation
          services, process bookings, prepare quotations and invoices, communicate with
          customers, provide customer support, maintain customer records, and improve our
          services and website.
        </p>

        <h2>6. Information Sharing</h2>
        <p>
          We do not sell customer information. Information may be shared where reasonably
          necessary to provide requested services, operate our website and systems, communicate
          with customers, or comply with applicable legal requirements.
        </p>

        <h2>7. Cookies and Website Technologies</h2>
        <p>
          Our website may use cookies, local storage, authentication technologies, and similar
          technical mechanisms to maintain sessions, remember preferences, support security,
          and provide website functionality.
        </p>

        <h2>8. Data Security</h2>
        <p>
          We take reasonable measures to protect customer information against unauthorized
          access, alteration, disclosure, or loss. However, no internet-based system can be
          guaranteed to be completely secure.
        </p>

        <h2>9. Customer Rights and Choices</h2>
        <p>
          Customers may contact us regarding their personal information, request correction
          of inaccurate information, or ask questions about how their information is handled.
        </p>

        <h2>10. Account and Data Deletion</h2>
        <p>
          Customers who wish to close their account or make a request concerning deletion of
          personal information may contact Concept Cleaning Services using the contact details
          provided on our website. Some information may need to be retained where required for
          legitimate business or legal purposes.
        </p>

        <h2>11. Data Retention</h2>
        <p>
          We retain information for as long as reasonably necessary to provide services,
          maintain appropriate business records, resolve disputes, and meet applicable
          obligations.
        </p>

        <h2>12. Children's Privacy</h2>
        <p>
          Our online customer services are intended for adults and are not directed toward
          children.
        </p>

        <h2>13. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. The updated version will be
          published on this page with a revised update date.
        </p>

        <h2>14. Contact Us</h2>
        <p>
          For privacy questions or requests, please contact Concept Cleaning Services through
          the contact information published on our website.
        </p>

        <p className="mt-8">
          <Link to="/terms-and-conditions" className="text-primary hover:underline">
            View Terms & Conditions
          </Link>
        </p>
      </article>
    </div>
  );
}
