import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, ChevronDown, Droplets, Home, MessageCircle, Sofa,
  Building2, CarFront, Bug, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import conceptLogo from '@/assets/concept-cleaning-logo.png';
import commercialHero from '@/assets/market/commercial.jpg';
import { waLink } from '@/components/public/PublicShell';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import {
  categoryImage,
  fetchMarketCategories,
} from '@/lib/marketplace';
import BookingEngine from '@/components/public/BookingEngine';

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
  const [marketCategories, setMarketCategories] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    fetchMarketCategories()
      .then((categories) => {
        if (mounted) setMarketCategories(categories);
      })
      .catch((error) => {
        console.error('Landing categories could not be loaded:', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const title = 'Concept Cleaning Services | Professional Cleaning in Nairobi';
  const description = 'Book professional home, office, upholstery, carpet and car interior cleaning, plus fumigation and pest control in Nairobi and nearby areas.';

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href="https://www.conceptcleaningservices.co.ke/" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
      </Helmet>

      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]" style={{ "--primary": "#0F766E", "--primary-dark": "#115E59", "--secondary": "#0284C7", "--cta": "#F97316", "--cta-text": "#0F172A", "--cta-hover": "#EA580C", "--whatsapp": "#25D366", "--whatsapp-text": "#0B3D1E", "--success": "#16A34A", "--bg": "#F8FAFC", "--surface": "#FFFFFF", "--text": "#0F172A", "--muted": "#475569", "--border": "#E2E8F0", "--error": "#DC2626" } as React.CSSProperties}>
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
              <a href="#services" className="transition-colors hover:text-black">Services</a>
              <a href="#why-us" className="transition-colors hover:text-black">About Us</a>
              <a href="#gallery" className="transition-colors hover:text-black">Gallery</a>
              <a href="#contact" className="transition-colors hover:text-black">Contact</a>
            </nav>
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="outline" className="border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[#f5f5f5]">
                <Link to="/marketplace">Browse services</Link>
              </Button>
              <Button asChild className="bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]">
                <a href={waHome} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Book on WhatsApp</a>
              </Button>
            </div>
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] sm:hidden" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(v => !v)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileMenuOpen && <nav className="grid gap-1 border-t border-[#eeeeee] px-4 py-3 sm:hidden" aria-label="Mobile navigation">
            <a href="#services" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">Services</a>
            <a href="#why-us" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">About Us</a>
            <Link to="/my/account" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">My Account</Link>
            <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">Gallery</a>
            <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">Contact</a>
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
              <div className="w-full max-w-3xl">
                <BookingEngine phone={phone} />
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="scroll-mt-24 overflow-hidden bg-[#F1F8F8] py-16 sm:py-20">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-4 sm:flex-row sm:items-end sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#0F766E]">What we do</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#102A2A] sm:text-4xl">Our Services</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#475569] sm:text-base">Specialist care for every space, from everyday home cleaning to professional pest control.</p>
            </div>
            <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#0F766E] hover:text-[#115E59]">View All Services <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="service-marquee mt-8" aria-label="Cleaning service categories">
            <div className="service-marquee__track">
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  className="service-marquee__group"
                  aria-hidden={copy === 1 ? true : undefined}
                >
                  {marketCategories.map((category) => (
                    <Link
                      key={category}
                      to={`/categories?c=${encodeURIComponent(category)}`}
                      tabIndex={copy === 1 ? -1 : undefined}
                      className="service-marquee__card group"
                    >
                      <img src={categoryImage(category)} alt={copy === 1 ? '' : category} loading="lazy" />
                      <span className="service-marquee__shade" />
                      <span className="service-marquee__icon"><Droplets className="h-5 w-5" /></span>
                      <span className="service-marquee__title">{category}</span>
                      <span className="service-marquee__arrow"><ArrowRight className="h-4 w-4" /></span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <style>{`
            .service-marquee { overflow: hidden; width: 100%; }
            .service-marquee__track { display: flex; width: max-content; animation: ccs-service-marquee 42s linear infinite; }
            .service-marquee:hover .service-marquee__track, .service-marquee:focus-within .service-marquee__track { animation-play-state: paused; }
            .service-marquee__group { display: flex; flex: none; gap: 18px; padding: 0 9px; }
            .service-marquee__card { position: relative; display: flex; width: 270px; height: 300px; flex: none; overflow: hidden; flex-direction: column; justify-content: flex-end; border-radius: 18px; background: #0F766E; color: white; box-shadow: 0 10px 28px rgb(15 23 42 / 12%); }
            .service-marquee__card img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 450ms ease; }
            .service-marquee__card:hover img { transform: scale(1.06); }
            .service-marquee__shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(3 28 30 / 3%) 20%, rgb(3 28 30 / 88%) 100%); }
            .service-marquee__icon { position: absolute; top: 18px; left: 18px; display: flex; width: 44px; height: 44px; align-items: center; justify-content: center; border: 1px solid rgb(255 255 255 / 40%); border-radius: 13px; background: rgb(7 59 58 / 55%); backdrop-filter: blur(8px); }
            .service-marquee__title { position: relative; z-index: 1; max-width: 220px; padding: 0 20px 22px; font-size: 20px; font-weight: 800; line-height: 1.2; }
            .service-marquee__arrow { position: absolute; right: 16px; bottom: 18px; z-index: 1; display: flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 999px; background: #F97316; color: #172033; }
            @keyframes ccs-service-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
            @media (max-width: 640px) { .service-marquee__card { width: 230px; height: 260px; } .service-marquee__group { gap: 12px; padding: 0 6px; } .service-marquee__track { animation-duration: 34s; } }
            @media (prefers-reduced-motion: reduce) { .service-marquee__track { animation: none; } .service-marquee { overflow-x: auto; } }
          `}</style>
        </section>

        <section id="why-us" className="scroll-mt-24 border-b border-[var(--border)]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:px-8">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--muted)]">Before you book</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Know the service before you request it.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                Each service page brings together the information available for that service, including its description, recorded features, estimated duration and pricing details. Review these details before submitting your booking request.
              </p>
              <Button asChild className="mt-7 bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]">
                <Link to="/marketplace">Browse the service catalogue <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
              <h3 className="text-lg font-extrabold">What to check on a service page</h3>
              <ul className="mt-5 space-y-4 text-sm leading-6 text-[var(--muted)]">
                <li><strong className="text-[var(--text)]">Description:</strong> Read the service description to understand the listed scope.</li>
                <li><strong className="text-[var(--text)]">Features:</strong> Check the specific features recorded for that service.</li>
                <li><strong className="text-[var(--text)]">Duration:</strong> Review the estimated duration where one is provided.</li>
                <li><strong className="text-[var(--text)]">Pricing:</strong> Check whether the service is fixed-price, unit-based, area-based or quotation-based.</li>
              </ul>
            </div>
          </div>
        </section>

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
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[var(--muted)]"><Link to="/marketplace" className="hover:text-black">Services</Link><Link to="/customer-auth?next=/my" className="hover:text-black">Customer account</Link><Link to="/privacy-policy" className="hover:text-black">Privacy</Link><Link to="/terms-and-conditions" className="hover:text-black">Terms</Link><a href={`tel:${phone}`} className="hover:text-black">Call us</a></div>
          </div>
        </footer>
      </main>
    </div>
  );
}
