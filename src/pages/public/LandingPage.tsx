import { lazy, Suspense, useState } from 'react';

import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, ChevronDown, Home, MessageCircle, Sofa,
  Building2, CarFront, Bug, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import conceptLogo from '@/assets/concept-cleaning-logo.png';
import commercialHero from '@/assets/market/commercial.jpg';
import { waLink } from '@/components/public/PublicShell';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import BookingEngine from '@/components/public/BookingEngine';

const HomeBlogPreview = lazy(() => import('./BlogIndex').then((module) => ({ default: module.HomeBlogPreview })));

const FAQS = [
  {
    q: 'How do I find the right service?',
    a: 'Browse the service categories, open a service to read its description and listed features, then use its booking or quotation option.',
  },
  {
    q: 'How are service prices displayed?',
    a: 'A listed fixed price is shown as configured. Services priced by unit or area show their applicable rate. Where no price is configured, the service is marked as available on quotation.',
  },
  {
    q: 'Can I check how long a service takes?',
    a: 'Where an estimated duration has been provided for a service, it appears on the service listing and detail page. Actual time can depend on the requirements of the job.',
  },
  {
    q: 'How do I make a booking?',
    a: 'Open the service you need, review its details and use the booking form. You can also contact Concept Cleaning Services on WhatsApp.',
  },
  {
    q: 'Where can I see what a service includes?',
    a: 'Open an individual service to read its full description and any service features recorded in the catalogue.',
  },
];

export default function LandingPage() {
  const { general } = usePublicSettings();
  const phone = general.phone || '+254796563741';
  const waHome = waLink(phone, 'Hello Concept Cleaning Services, I would like to book a cleaning service.');
  const waQuote = waLink(phone, 'Hello Concept Cleaning Services, I would like to enquire about your services.');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const title = 'Professional Cleaning Services in Nairobi, Kenya | Concept Cleaning';
  const description = 'Concept Cleaning Services provides professional residential, office, commercial, carpet, sofa, mattress and post-construction cleaning, plus pest control in Nairobi and nearby areas.';

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://www.conceptcleaningservices.co.ke/" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.conceptcleaningservices.co.ke/" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content="https://www.conceptcleaningservices.co.ke/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="https://www.conceptcleaningservices.co.ke/og-image.png" />
      </Helmet>

      <main className="min-h-screen bg-[var(--bg)] pb-0 text-[var(--text)] lg:pb-0" style={{ "--primary": "#0F766E", "--primary-dark": "#115E59", "--secondary": "#0284C7", "--cta": "#F97316", "--cta-text": "#0F172A", "--cta-hover": "#EA580C", "--whatsapp": "#25D366", "--whatsapp-text": "#0B3D1E", "--success": "#16A34A", "--bg": "#F8FAFC", "--surface": "#FFFFFF", "--text": "#0F172A", "--muted": "#475569", "--border": "#E2E8F0", "--error": "#DC2626" } as React.CSSProperties}>
        <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Concept Cleaning Services home">
              <img src={conceptLogo} alt="Concept Cleaning Services" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold tracking-tight sm:text-base">CONCEPT CLEANING</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Services • Nairobi</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--muted)] lg:flex" aria-label="Main navigation">
              <a href="#home" className="transition-colors hover:text-black">Home</a>
              <Link to="/services" className="transition-colors hover:text-black">Services</Link>
              <Link to="/about" className="transition-colors hover:text-black">About Us</Link>
              <Link to="/blog" className="transition-colors hover:text-black">Blog</Link>
              <Link to="/contact" className="transition-colors hover:text-black">Contact</Link>
            </nav>
            <div className="hidden items-center gap-2 lg:flex">
              <Button asChild variant="outline" className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[#f5f5f5]">
                <Link to="/marketplace">Browse services</Link>
              </Button>
              <Button asChild className="bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]">
                <a href={waHome} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Book on WhatsApp</a>
              </Button>
            </div>
            <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] lg:hidden" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(v => !v)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileMenuOpen && <nav className="grid gap-1 border-t border-[#eeeeee] px-4 py-3 lg:hidden" aria-label="Mobile navigation">
            <Link to="/services" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[#f5f5f5]">Services</Link>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[#f5f5f5]">About Us</Link>
            <Link to="/blog" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[#f5f5f5]">Blog</Link>
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[#f5f5f5]">Contact</Link>
            <Link to="/my/account" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-[#f5f5f5]">My Account</Link>
            <Button asChild className="mt-1 bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]"><Link to="/marketplace">Browse services</Link></Button>
          </nav>}
        </header>

        <section id="home" className="relative isolate min-h-[520px] overflow-hidden bg-[#073B3A] sm:min-h-[560px] lg:min-h-[600px]">
          <img
            src={commercialHero}
            alt="Professional cleaner caring for a modern home"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
            fetchPriority="high"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#062F30]/95 via-[#063B3B]/82 to-[#062F30]/15" aria-hidden="true" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#062F30]/50 via-transparent to-black/10" aria-hidden="true" />
          <div className="mx-auto flex min-h-[520px] max-w-7xl items-center justify-center px-4 py-10 sm:min-h-[560px] sm:px-6 sm:py-14 lg:min-h-[600px] lg:px-8 lg:py-16">
            <div className="w-full max-w-4xl text-white">
              <div className="mb-6 max-w-3xl">
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/80">Concept Cleaning Services · Nairobi, Kenya</p>
                <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">Professional Cleaning Services in Nairobi, Kenya</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 sm:text-base">Reliable cleaning solutions for homes, offices and commercial properties. Find the service you need, request a quotation or start your booking below.</p>
              </div>
              <div className="w-full max-w-3xl">
                <BookingEngine phone={phone} />
              </div>
            </div>
          </div>
        </section>

        <section id="cleaning-services-nairobi" className="border-y border-[var(--border)] bg-white py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--primary)]">Cleaning for homes and businesses</p>
              <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-[var(--text)] sm:text-4xl">Your Professional Cleaning Services Company in Nairobi, Kenya</h2>
              <p className="mt-5 text-base leading-8 text-[var(--muted)]">
                Concept Cleaning Services provides customised residential and commercial cleaning services in Nairobi, Kenya. Whether you need help maintaining a home, preparing a property for occupation, refreshing carpets and upholstery or keeping a workplace clean, we help you find a service suited to your space and requirements.
              </p>
              <p className="mt-4 text-base leading-8 text-[var(--muted)]">
                If you are looking for affordable cleaning services in Nairobi without compromising on professional standards, our team can help you choose the right service. We focus on careful work, suitable cleaning methods and equipment, and clear communication from enquiry through to service delivery.
              </p>
            </div>

            <div className="mt-12">
              <div className="max-w-3xl">
                <h2 className="text-2xl font-black tracking-tight text-[var(--text)] sm:text-3xl">Cleaning Services We Provide</h2>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">Explore some of the cleaning solutions available for residential and commercial properties. Service availability and the recommended approach depend on the property, surface and scope of work.</p>
              </div>
              <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6">
                  <h3 className="text-lg font-extrabold text-[var(--text)]">Office Cleaning Services</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Maintain a clean, organised and welcoming workplace with professional office cleaning in Nairobi. Cleaning can be arranged around your premises and operating routine, including work areas, floors, shared spaces, kitchens and washrooms.</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Our commercial cleaning options can also cover janitorial support, washroom hygiene, carpet care, hard-floor cleaning and scheduled or one-off deep cleaning.</p>
                </article>
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6">
                  <h3 className="text-lg font-extrabold text-[var(--text)]">Carpet and Rug Cleaning</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Carpets and rugs collect dust, grit and everyday marks through regular use. Professional carpet cleaning helps refresh floor coverings and care for the fibres using methods and equipment selected for the material and its condition.</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Ask us about carpet cleaning for homes, offices and other spaces in Nairobi.</p>
                </article>
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6">
                  <h3 className="text-lg font-extrabold text-[var(--text)]">Sofa and Upholstery Cleaning</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Sofas and upholstered furniture need the right care to remove accumulated dust and everyday soiling. Our sofa cleaning process starts with an assessment and preparation of the upholstery, followed by suitable cleaning for the fabric or material.</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">We clean different types of sofa upholstery, taking the material and its condition into account when selecting the appropriate method.</p>
                </article>
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6">
                  <h3 className="text-lg font-extrabold text-[var(--text)]">Mattress Cleaning</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Mattresses can accumulate dust, perspiration and everyday contaminants over time. Professional mattress cleaning helps refresh the sleeping surface as part of a cleaner bedroom and a more comfortable home.</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Contact our team to discuss the mattress type, its condition and the most suitable cleaning option.</p>
                </article>
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6">
                  <h3 className="text-lg font-extrabold text-[var(--text)]">Post-Construction Cleaning</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">After renovation or construction, a property needs detailed cleaning before it is ready for use. Post-construction cleaning may include removal of loose debris, high-dust cleaning, wall and surface washing where suitable, vacuuming, sweeping and mopping.</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">We can also address details such as door frames, baseboards, windows and other accessible surfaces according to the agreed scope.</p>
                </article>
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6">
                  <h3 className="text-lg font-extrabold text-[var(--text)]">Housekeeping and Domestic Cleaning</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Keep your home in order with one-off or recurring domestic cleaning. Housekeeping can be tailored to your priorities and may include bedrooms, living areas, kitchens, bathrooms and general household surfaces.</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Whether you need help with routine home care or a more detailed clean, tell us what matters most and we can discuss a suitable arrangement.</p>
                </article>
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6">
                  <h3 className="text-lg font-extrabold text-[var(--text)]">Commercial and Industrial Cleaning</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">A clean business environment supports a more pleasant experience for staff, customers and visitors. Our commercial cleaning services are suitable for a range of business premises, with the work planned around the property and its cleaning requirements.</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Enquire about cleaning for offices, shops, schools, colleges, restaurants, warehouses, factories, shopping centres, gyms, studios and other commercial spaces.</p>
                </article>
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6">
                  <h3 className="text-lg font-extrabold text-[var(--text)]">Residential Cleaning Services</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Our residential cleaning options support apartments, houses and other living spaces. Choose a one-off clean or enquire about regular domestic cleaning based on your schedule, property size and priorities.</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">We aim to make it easier to care for your home while you focus on the rest of your day.</p>
                </article>
                <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6">
                  <h3 className="text-lg font-extrabold text-[var(--text)]">Deep Cleaning and Move-In / Move-Out Cleaning</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">Some spaces need more than routine cleaning. A detailed deep clean can focus on built-up dirt and areas that need extra attention. Move-in and move-out cleaning helps prepare a property for new occupants or handover.</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">The scope is discussed before work begins so the service can be planned around the property's condition and your requirements.</p>
                </article>
              </div>
            </div>

            <div className="mt-14 grid gap-8 rounded-3xl bg-[#F1F8F8] p-6 sm:p-9 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0F766E]">For every kind of property</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-[#102A2A] sm:text-3xl">Residential and Commercial Cleaning Across Nairobi</h2>
                <p className="mt-4 text-sm leading-7 text-[#475569] sm:text-base">Concept Cleaning Services supports homes and a variety of business environments. Depending on the service, property requirements and agreed scope, we can discuss cleaning for:</p>
                <ul className="mt-5 grid gap-2 text-sm font-semibold text-[#334155] sm:grid-cols-2">
                  {['Homes and apartments', 'Offices and business premises', 'Shops and retail spaces', 'Schools and learning institutions', 'Restaurants and hospitality spaces', 'Warehouses and industrial premises', 'Gyms, studios and shared facilities', 'Common areas and managed properties'].map((item) => <li key={item} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0F766E]" />{item}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-[#102A2A]">Why Choose Concept Cleaning Services?</h3>
                <div className="mt-5 space-y-4">
                  <div><h4 className="font-extrabold text-[#102A2A]">Cleaning planned around your needs</h4><p className="mt-1 text-sm leading-7 text-[#475569]">We discuss your priorities and the property requirements so the work can be tailored to the areas that matter to you.</p></div>
                  <div><h4 className="font-extrabold text-[#102A2A]">Professional cleaning approach</h4><p className="mt-1 text-sm leading-7 text-[#475569]">Our team uses suitable cleaning methods and equipment for the task, surface and material being cleaned.</p></div>
                  <div><h4 className="font-extrabold text-[#102A2A]">Options for homes and businesses</h4><p className="mt-1 text-sm leading-7 text-[#475569]">From domestic housekeeping to office and commercial cleaning, you can enquire about services for different property types.</p></div>
                  <div><h4 className="font-extrabold text-[#102A2A]">Straightforward booking and enquiries</h4><p className="mt-1 text-sm leading-7 text-[#475569]">Use the booking engine above to find a service, request a quotation or send an enquiry to our team.</p></div>
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-2xl border border-[var(--border)] p-6 sm:flex-row sm:items-center sm:p-8">
              <div>
                <h2 className="text-xl font-black tracking-tight text-[var(--text)] sm:text-2xl">Looking for cleaning services in Nairobi and nearby areas?</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">We serve customers in Nairobi and selected surrounding areas, including parts of Kiambu, Kajiado and Machakos. Share your location and the service you need so our team can confirm availability.</p>
              </div>
              <a href={waQuote} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[var(--primary-dark)]"><MessageCircle className="h-4 w-4" />Enquire on WhatsApp</a>
            </div>
          </div>
        </section>

        <Suspense fallback={<section id="blog" className="bg-white py-16"><div className="mx-auto max-w-7xl px-4 text-sm text-slate-500">Loading latest articles…</div></section>}>
          <HomeBlogPreview />
        </Suspense>

        <section id="contact" className="scroll-mt-24 px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 rounded-3xl bg-[var(--primary)] p-7 text-white sm:p-10 lg:flex-row lg:items-center lg:p-12">
            <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Need help choosing a service?</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Talk to our team about your cleaning needs.</h2><p className="mt-3 text-sm leading-6 text-white/70 sm:text-base">If you are unsure which listed service fits your requirements, contact our team before booking.</p></div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="bg-[var(--surface)] text-[var(--text)] hover:bg-[#eeeeee]"><Link to="/marketplace">Browse services <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-[var(--surface)]/10 hover:text-white"><a href={waQuote} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Enquire on WhatsApp</a></Button></div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="text-center"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--muted)]">Helpful answers</p><h2 className="mt-3 text-3xl font-black tracking-tight">Frequently asked questions</h2></div>
          <div className="mt-8 divide-y divide-[#e7e7e7] border-y border-[var(--border)]">
            {FAQS.map((faq, i) => <div key={faq.q} className="py-1"><button type="button" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-4 text-left font-bold"><span>{faq.q}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} /></button>{openFaq === i && <p className="max-w-3xl pb-5 pr-8 text-sm leading-6 text-[var(--muted)]">{faq.a}</p>}</div>)}
          </div>
        </section>

        <footer className="border-t border-[var(--border)] bg-[var(--bg)]">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div><p className="font-extrabold tracking-tight">CONCEPT CLEANING SERVICES</p><p className="mt-1 text-sm text-[var(--muted)]">Professional cleaning and pest control in Nairobi, Kenya.</p><p className="mt-2 text-xs text-[#888888]">© {new Date().getFullYear()} Concept Cleaning Services.</p></div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[var(--muted)]"><Link to="/services" className="hover:text-black">Services</Link><Link to="/about" className="hover:text-black">About Us</Link><Link to="/contact" className="hover:text-black">Contact</Link><Link to="/blog" className="hover:text-black">Blog</Link><Link to="/customer-auth?next=/my" className="hover:text-black">Customer account</Link><Link to="/privacy-policy" className="hover:text-black">Privacy</Link><Link to="/terms-and-conditions" className="hover:text-black">Terms</Link><a href={`tel:${phone}`} className="hover:text-black">Call us</a></div>
          </div>
        </footer>

      </main>
    </div>
  );
}
