import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Headphones,
  MapPin, Menu, MessageCircle, Search, ShieldCheck, Truck, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import conceptLogo from '@/assets/concept-cleaning-logo.png';
import commercialHero from '@/assets/market/commercial.jpg';
import { waLink } from '@/components/public/PublicShell';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import BookingEngine from '@/components/public/BookingEngine';
import { ServicesCatalogueContent } from './MarketingPages';
import SocialLinks from '@/components/public/SocialLinks';

export default function LandingPage() {
  const { general } = usePublicSettings();
  const phone = general.phone || '+254796563741';
  const company = general.company_name || 'Concept Cleaning Services';
  const logo = general.logo_url || conceptLogo;
  const waHome = waLink(phone, 'Hello Concept Cleaning Services, I would like to book a cleaning service.');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const title = 'Professional Cleaning Services in Nairobi, Kenya | Concept Cleaning';
  const description = 'Concept Cleaning Services provides professional residential, office, commercial, carpet, sofa, mattress and post-construction cleaning, plus pest control in Nairobi and nearby areas.';

  return (
    <div className="ccs-market-home min-h-screen bg-white text-slate-900">
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

      <style>{`
        .ccs-market-home { --market-ink:#202833; --market-muted:#64748b; --market-orange:#f59e0b; --market-orange-dark:#d97706; --market-border:#e5e7eb; }
        .ccs-market-home .market-catalogue > section:first-child { background:#202833; color:#fff; padding-top:2.25rem; padding-bottom:2.25rem; }
        .ccs-market-home .market-catalogue > section:first-child h1 { color:#fff; font-size:clamp(1.6rem,3vw,2.3rem); }
        .ccs-market-home .market-catalogue > section:first-child p { color:#e2e8f0; }
        .ccs-market-home .market-catalogue > section:nth-child(2) { padding-top:2.5rem; }
        .ccs-market-home .market-catalogue > section:nth-child(2) a { border-radius:1rem; box-shadow:0 2px 10px rgba(15,23,42,.07); }
        .ccs-market-home .market-catalogue > section:nth-child(2) a:hover { border-color:#f59e0b; box-shadow:0 10px 25px rgba(15,23,42,.12); }
        .ccs-market-home .market-catalogue > section:nth-child(2) a h2 { color:#202833; }
        .ccs-market-home .market-catalogue > section:nth-child(2) a:hover h2 { color:#b45309; }
        .ccs-market-home .market-catalogue > section:nth-child(2) a span { color:#b45309; }
        @media (prefers-reduced-motion: reduce) {
          .ccs-market-home * { scroll-behavior:auto !important; transition-duration:0.01ms !important; animation-duration:0.01ms !important; }
        }
      `}</style>

      <div className="bg-[#202833] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 text-xs font-semibold sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 text-white/90"><MapPin className="h-3.5 w-3.5 text-amber-400" /> Nairobi, Kenya</span>
          <div className="flex items-center gap-4 text-white/80">
            <a href={`tel:${phone}`} className="hidden hover:text-white sm:inline">{phone}</a>
            <Link to="/customer-auth?next=/my" className="hover:text-white">My Account</Link>
            <a href="/admin" className="hover:text-white">Staff Login</a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 shrink-0 items-center gap-3" aria-label={company + ' home'}>
            <img src={logo} alt={company + ' logo'} className="h-11 w-11 rounded-xl object-contain sm:h-12 sm:w-12" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-black tracking-tight text-[#202833] sm:text-base">CONCEPT CLEANING</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Services · Nairobi</span>
            </span>
          </Link>

          <Link to="/marketplace" className="ml-auto hidden min-w-0 max-w-xl flex-1 items-center gap-3 rounded-full border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 transition hover:border-amber-400 hover:bg-white md:flex">
            <Search className="h-5 w-5 shrink-0 text-slate-700" />
            <span className="flex-1">Search cleaning and pest-control services...</span>
            <span className="rounded-full bg-[#202833] px-4 py-1.5 font-bold text-white">Search</span>
          </Link>

          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <div className="flex items-center gap-2 px-2 text-xs font-semibold text-slate-600">
              <ShieldCheck className="h-7 w-7 text-slate-800" />
              <span>Professional<br />Service</span>
            </div>
            <Button asChild className="h-11 rounded-lg bg-amber-500 px-5 font-extrabold text-slate-950 hover:bg-amber-400">
              <a href={waHome} target="_blank" rel="noopener noreferrer"><CalendarDays className="mr-2 h-4 w-4" />Book Now</a>
            </Button>
          </div>

          <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 lg:hidden" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(v => !v)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <nav className="hidden border-t border-slate-100 lg:block" aria-label="Main navigation">
          <div className="mx-auto flex max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-8">
            <Link to="/services" className="inline-flex items-center gap-2 bg-amber-500 px-5 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-400">All Services <ChevronDown className="h-4 w-4" /></Link>
            <Link to="/" className="border-b-2 border-amber-500 py-3 text-sm font-bold text-slate-900">Home</Link>
            <Link to="/services" className="py-3 text-sm font-semibold text-slate-600 hover:text-slate-950">Our Services</Link>
            <Link to="/packages" className="py-3 text-sm font-semibold text-slate-600 hover:text-slate-950">Packages</Link>
            <Link to="/blog" className="py-3 text-sm font-semibold text-slate-600 hover:text-slate-950">Cleaning Guides</Link>
            <Link to="/about" className="py-3 text-sm font-semibold text-slate-600 hover:text-slate-950">About Us</Link>
            <Link to="/contact" className="py-3 text-sm font-semibold text-slate-600 hover:text-slate-950">Contact</Link>
          </div>
        </nav>

        {mobileMenuOpen && (
          <nav className="grid gap-1 border-t border-slate-200 bg-white px-4 py-3 lg:hidden" aria-label="Mobile navigation">
            <Link to="/services" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-bold hover:bg-slate-50">All Services</Link>
            <Link to="/packages" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-slate-50">Packages</Link>
            <Link to="/blog" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-slate-50">Cleaning Guides</Link>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-slate-50">About Us</Link>
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold hover:bg-slate-50">Contact</Link>
            <Link to="/marketplace" onClick={() => setMobileMenuOpen(false)} className="mt-1 rounded-lg bg-amber-500 px-4 py-3 text-center text-sm font-extrabold text-slate-950">Browse and book services</Link>
          </nav>
        )}
      </header>

      <main>
        <section id="home" className="relative isolate overflow-hidden bg-[#202833]">
          <div className="absolute inset-0 -z-20">
            <img src={commercialHero} alt="" className="h-full w-full object-cover object-center" fetchPriority="high" />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#17212d]/95 via-[#17212d]/85 to-[#17212d]/25" aria-hidden="true" />
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_.85fr] lg:px-8 lg:py-20">
            <div className="max-w-2xl text-white">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.17em] text-amber-300">Concept Cleaning Services · Nairobi</p>
              <h1 className="mt-5 text-3xl font-black leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">A Cleaner, Healthier Home <span className="text-amber-400">Awaits You</span></h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-white/85 sm:text-base">Professional cleaning and pest-control services for homes, offices and commercial spaces. Find the service you need and request a booking or quotation.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#booking" className="inline-flex h-12 items-center rounded-lg bg-amber-500 px-6 text-sm font-extrabold text-slate-950 shadow-lg transition hover:bg-amber-400">Find a Service <ArrowRight className="ml-2 h-4 w-4" /></a>
                <Link to="/services" className="inline-flex h-12 items-center rounded-lg border border-white/50 bg-white/10 px-6 text-sm font-bold text-white hover:bg-white/20">Explore Services</Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/90">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" />Professional teams</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" />Clear service options</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" />Booking support</span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-2 shadow-2xl backdrop-blur-sm">
              <img src={commercialHero} alt="Professional cleaning service for a commercial interior" className="h-56 w-full rounded-xl object-cover sm:h-72 lg:h-[390px]" />
              <div className="absolute bottom-5 left-5 right-5 rounded-xl bg-white/95 p-4 shadow-xl sm:bottom-7 sm:left-7 sm:right-7 sm:p-5">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-amber-700">A simpler way to book</p>
                <p className="mt-1 text-lg font-black text-slate-900 sm:text-xl">Tell us what needs cleaning.</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">Search our services and send your booking request online.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="booking" className="relative z-10 -mt-5 scroll-mt-28 px-4 pb-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-700">Smart service search</p><h2 className="mt-1 text-lg font-black text-slate-900 sm:text-xl">What cleaning service are you looking for?</h2></div>
              <Link to="/marketplace" className="text-xs font-bold text-slate-600 hover:text-amber-700">Browse marketplace <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>
            </div>
            <BookingEngine phone={phone} />
          </div>
        </section>

        <div className="market-catalogue">
          <ServicesCatalogueContent />
        </div>

        <section className="border-y border-slate-200 bg-[#202833] text-white">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 py-7 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            <div className="flex items-center gap-3"><Headphones className="h-9 w-9 shrink-0 text-amber-400" /><span><strong className="block text-sm">Customer Support</strong><span className="text-xs text-white/70">Help with your service request</span></span></div>
            <div className="flex items-center gap-3"><ShieldCheck className="h-9 w-9 shrink-0 text-amber-400" /><span><strong className="block text-sm">Professional Service</strong><span className="text-xs text-white/70">Careful, service-focused teams</span></span></div>
            <div className="flex items-center gap-3"><CalendarDays className="h-9 w-9 shrink-0 text-amber-400" /><span><strong className="block text-sm">Flexible Requests</strong><span className="text-xs text-white/70">Tell us your preferred schedule</span></span></div>
            <div className="flex items-center gap-3"><Truck className="h-9 w-9 shrink-0 text-amber-400" /><span><strong className="block text-sm">Nairobi Coverage</strong><span className="text-xs text-white/70">Nairobi and selected nearby areas</span></span></div>
          </div>
        </section>

        <section className="bg-amber-500 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div><h2 className="text-xl font-black sm:text-2xl">Get in Touch Today for a Cleaner Tomorrow</h2><p className="mt-1 text-sm font-medium text-slate-800">Talk to our team about the right service for your property.</p></div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="bg-[#202833] text-white hover:bg-slate-800"><a href={waHome} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp Us</a></Button>
              <Button asChild variant="outline" className="border-slate-900 bg-transparent text-slate-950 hover:bg-amber-400"><Link to="/contact">Contact Details</Link></Button>
            </div>
          </div>
        </section>

        <footer className="bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div><p className="font-extrabold tracking-tight">CONCEPT CLEANING SERVICES</p><p className="mt-1 text-sm text-slate-500">Professional cleaning and pest control in Nairobi, Kenya.</p><SocialLinks /><p className="mt-2 text-xs text-slate-400">© {new Date().getFullYear()} Concept Cleaning Services.</p></div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600"><Link to="/services" className="hover:text-slate-950">Services</Link><Link to="/packages" className="hover:text-slate-950">Packages</Link><Link to="/about" className="hover:text-slate-950">About Us</Link><Link to="/contact" className="hover:text-slate-950">Contact</Link><Link to="/blog" className="hover:text-slate-950">Blog</Link><Link to="/customer-auth?next=/my" className="hover:text-slate-950">Customer account</Link><Link to="/privacy-policy" className="hover:text-slate-950">Privacy</Link><Link to="/terms-and-conditions" className="hover:text-slate-950">Terms</Link><a href="/admin" className="hover:text-slate-950">Staff login</a><a href={`tel:${phone}`} className="hover:text-slate-950">Call us</a></div>
          </div>
        </footer>
      </main>
    </div>
  );
}
