import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, CheckCircle2, ChevronDown, Clock3, Droplets, Home,
  MessageCircle, ShieldCheck, Sparkles, SprayCan, Sofa, Building2,
  CarFront, Bug, MapPin, Star, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PublicShell, { waLink } from '@/components/public/PublicShell';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import { categoryImage, fetchMarketCategories } from '@/lib/marketplace';

const SERVICES = [
  { title: 'Home cleaning', text: 'Thoughtful everyday, deep and move-in cleaning for a fresher home.', icon: Home, category: 'Residential Cleaning' },
  { title: 'Office cleaning', text: 'Professional care for offices, shops and business spaces.', icon: Building2, category: 'Commercial Cleaning' },
  { title: 'Sofa & upholstery', text: 'Lift everyday dirt and refresh the furniture you use most.', icon: Sofa, category: 'Upholstery Cleaning' },
  { title: 'Carpet & rugs', text: 'A deeper clean for carpets, rugs and high-traffic areas.', icon: Droplets, category: 'Carpet & Rug Cleaning' },
  { title: 'Fumigation & pest control', text: 'Targeted treatment for common household and workplace pests.', icon: Bug, category: 'Fumigation & Pest Control' },
  { title: 'Car interior detailing', text: 'Give your vehicle cabin a cleaner, more comfortable feel.', icon: CarFront, category: 'Car Interior Cleaning' },
];

const FAQS = [
  { q: 'Which areas do you serve?', a: 'We serve Nairobi and selected locations in Kiambu, Kajiado and Machakos. Contact us to confirm availability in your estate.' },
  { q: 'How do I know the price?', a: 'Browse available services and their listed prices. If your job needs a tailored scope, request a free quotation.' },
  { q: 'How do I book?', a: 'Choose a service, review the details, then follow the booking steps. We will confirm availability and the next steps.' },
  { q: 'Do you provide fumigation?', a: 'Yes. We provide fumigation and pest-control services and share relevant preparation and re-entry guidance for your treatment.' },
];

export default function LandingPage() {
  const { general } = usePublicSettings();
  const phone = general.phone || '+254796563741';
  const waHome = waLink(phone, 'Hello Concept Cleaning Services, I would like to book a cleaning service.');
  const waQuote = waLink(phone, 'Hello Concept Cleaning Services, I would like a free quotation.');
  const [categories, setCategories] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    let active = true;
    fetchMarketCategories()
      .then((items) => { if (active) setCategories(items); })
      .catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, []);

  const title = 'Concept Cleaning Services | Professional Cleaning in Nairobi';
  const description = 'Book professional home, office, upholstery, carpet and car interior cleaning, plus fumigation and pest control in Nairobi and nearby areas.';

  return (
    <PublicShell hideMobileBar>
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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white"><Sparkles className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold tracking-tight sm:text-base">CONCEPT CLEANING</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Services • Nairobi</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--muted)] lg:flex" aria-label="Main navigation">
              <a href="#services" className="transition-colors hover:text-black">Our services</a>
              <a href="#how-it-works" className="transition-colors hover:text-black">How it works</a>
              <a href="#why-us" className="transition-colors hover:text-black">Why Concept</a>
              <a href="#faq" className="transition-colors hover:text-black">FAQs</a>
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
            <a href="#services" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">Our services</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">How it works</a>
            <a href="#why-us" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">Why Concept</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">FAQs</a>
            <Button asChild className="mt-1 bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]"><Link to="/marketplace">Browse services</Link></Button>
          </nav>}
        </header>

        <section className="relative isolate min-h-[560px] overflow-hidden bg-[#073B3A] sm:min-h-[610px] lg:min-h-[650px]">
          <img
            src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=2200&q=85"
            alt="Professional cleaner caring for a modern home"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
            fetchPriority="high"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#062F30]/95 via-[#063B3B]/82 to-[#062F30]/15" aria-hidden="true" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#062F30]/50 via-transparent to-black/10" aria-hidden="true" />
          <div className="mx-auto flex min-h-[560px] max-w-7xl items-center px-4 py-16 sm:min-h-[610px] sm:px-6 sm:py-20 lg:min-h-[650px] lg:px-8">
            <div className="max-w-3xl text-white">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-[#FDBA74]" /> Trusted cleaning across Nairobi
              </span>
              <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl">
                A Cleaner, Healthier <span className="text-[#5EEAD4]">Space for You</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
                Professional home, office, upholstery and car-interior cleaning, plus reliable fumigation and pest control — delivered with care.
              </p>
              <div className="mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center">
                <label className="flex min-h-12 flex-1 items-center gap-3 rounded-xl bg-white px-4 text-[#334155]">
                  <MapPin className="h-5 w-5 shrink-0 text-[#0F766E]" />
                  <select aria-label="Choose a cleaning service" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="h-12 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none">
                    <option value="" disabled>What cleaning service are you looking for?</option>
                    {SERVICES.map((service) => <option key={service.category} value={service.category}>{service.title}</option>)}
                  </select>
                </label>
                <Button asChild size="lg" className="min-h-12 rounded-xl bg-[#F97316] px-7 font-extrabold text-[#172033] hover:bg-[#FB923C]">
                  <Link to={selectedCategory ? `/categories?c=${encodeURIComponent(selectedCategory)}` : "/marketplace"}>Book Now <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-white/95">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#5EEAD4]" /> Trusted &amp; Reliable</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-[#5EEAD4]" /> Eco-Friendly Products</span>
                <span className="inline-flex items-center gap-2"><Star className="h-5 w-5 text-[#FDBA74]" /> Satisfaction Guaranteed</span>
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
                <div key={copy} className="service-marquee__group" aria-hidden={copy === 1 ? true : undefined}>
                  {[
                    { title: 'Residential Cleaning', category: 'Residential Cleaning', image: categoryImage('Residential Cleaning'), icon: Home },
                    { title: 'Upholstery Cleaning', category: 'Upholstery Cleaning', image: categoryImage('Upholstery Cleaning'), icon: Sofa },
                    { title: 'Carpet & Rug Cleaning', category: 'Carpet & Rug Cleaning', image: categoryImage('Carpet & Rug Cleaning'), icon: Droplets },
                    { title: 'Car Interior Cleaning', category: 'Car Interior Cleaning', image: categoryImage('Car Interior Cleaning'), icon: CarFront },
                    { title: 'Commercial Cleaning', category: 'Commercial Cleaning', image: categoryImage('Commercial Cleaning'), icon: Building2 },
                    { title: 'Fumigation & Pest Control', category: 'Fumigation & Pest Control', image: categoryImage('Fumigation & Pest Control'), icon: Bug },
                  ].map((service) => {
                    const Icon = service.icon;
                    return <Link key={service.category} to={copy === 1 ? '/marketplace' : `/categories?c=${encodeURIComponent(service.category)}`} tabIndex={copy === 1 ? -1 : undefined} className="service-marquee__card group">
                      <img src={service.image} alt={copy === 1 ? '' : service.title} loading="lazy" />
                      <span className="service-marquee__shade" />
                      <span className="service-marquee__icon"><Icon className="h-5 w-5" /></span>
                      <span className="service-marquee__title">{service.title}</span>
                      <span className="service-marquee__arrow"><ArrowRight className="h-4 w-4" /></span>
                    </Link>;
                  })}
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

        <section id="how-it-works" className="scroll-mt-24 border-y border-[#e9e9e9] bg-[var(--bg)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--muted)]">Simple from the start</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Book in a few clear steps.</h2></div>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {[{n:'01',title:'Choose what you need',text:'Browse services and check the details and available prices.'},{n:'02',title:'Share your requirements',text:'Select your service and send your booking request or ask for a quote.'},{n:'03',title:'Confirm the plan',text:'We follow up to confirm availability, service details and next steps.'}].map((step) => <div key={step.n} className="rounded-2xl border border-[#e4e4e4] bg-[var(--surface)] p-6"><span className="text-sm font-black tracking-widest text-[#999999]">{step.n}</span><h3 className="mt-5 text-lg font-extrabold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{step.text}</p></div>)}
            </div>
          </div>
        </section>

        <section id="why-us" className="scroll-mt-24 mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:px-8">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--muted)]">Why Concept</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Care in the details.<br />Clarity at every step.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)] sm:text-base">We make it easier to find the right service for your home or business, understand what is included and know how to move forward.</p>
            <Button asChild className="mt-7 bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)]"><Link to="/marketplace">Find your service <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[{icon:ShieldCheck,title:'Professional approach',text:'Clear service information and practical guidance.'},{icon:Clock3,title:'Convenient booking',text:'Send a request online or talk to us directly.'},{icon:Sparkles,title:'Services for real life',text:'From everyday cleaning to detailed refreshes.'},{icon:MapPin,title:'Locally focused',text:'Serving Nairobi and selected nearby areas.'}].map((item) => { const Icon = item.icon; return <div key={item.title} className="rounded-2xl border border-[var(--border)] p-5"><Icon className="h-5 w-5" /><h3 className="mt-4 font-extrabold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.text}</p></div>; })}
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 rounded-3xl bg-[var(--primary)] p-7 text-white sm:p-10 lg:flex-row lg:items-center lg:p-12">
            <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Ready when you are</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Let’s make your space feel new again.</h2><p className="mt-3 text-sm leading-6 text-white/70 sm:text-base">Browse services or tell us what you need and we’ll help you find the right next step.</p></div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="bg-[var(--surface)] text-[var(--text)] hover:bg-[#eeeeee]"><Link to="/marketplace">Browse services <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-[var(--surface)]/10 hover:text-white"><a href={waQuote} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp us</a></Button></div>
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
    </PublicShell>
  );
}
