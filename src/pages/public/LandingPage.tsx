import { useState } from 'react';

import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  MessageCircle, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import conceptLogo from '@/assets/concept-cleaning-logo.png';
import { waLink } from '@/components/public/PublicShell';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import BookingEngine from '@/components/public/BookingEngine';
import { ServicesCatalogueContent } from './MarketingPages';

export default function LandingPage() {
  const { general } = usePublicSettings();
  const phone = general.phone || '+254796563741';
  const waHome = waLink(phone, 'Hello Concept Cleaning Services, I would like to book a cleaning service.');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

        <ServicesCatalogueContent />

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
