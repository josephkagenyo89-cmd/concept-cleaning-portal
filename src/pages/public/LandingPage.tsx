import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, CalendarDays, ChevronRight, Headphones,
  MapPin, Menu, MessageCircle, Search, ShieldCheck, X
} from 'lucide-react';
import conceptLogo from '@/assets/concept-cleaning-logo.png';
import commercialHero from '@/assets/market/commercial.jpg';
import { waLink } from '@/components/public/PublicShell';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import { usePublicDiscount } from '@/hooks/usePublicDiscount';
import BookingEngine from '@/components/public/BookingEngine';
import { ServicesCatalogueContent } from './MarketingPages';
import SocialLinks from '@/components/public/SocialLinks';
import { fetchServiceCategories, type ServiceCategory } from '@/lib/serviceCategories';
import { categoryImage, CATEGORY_IMAGE_OPTIONS } from '@/lib/marketplace';
import { isBookingOfferCurrent } from '@/lib/bookingEngineOffers';

const landingBackgroundImages = CATEGORY_IMAGE_OPTIONS.filter((item) => item.key !== 'monthly-offers');

function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function LandingPage() {
  const { general } = usePublicSettings();
  const { discount } = usePublicDiscount();
  const phone = general.phone || '+254796563741';
  const company = general.company_name || 'Concept Cleaning Services';
  const logo = general.logo_url || conceptLogo;
  const waHome = waLink(phone, 'Hello Concept Cleaning Services, I would like to book a cleaning service.');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [featuredPackages, setFeaturedPackages] = useState<Array<{ id: string; title: string; description: string | null; starts_at: string | null; ends_at: string | null }>>([]);
  const title = 'Professional Cleaning Services in Nairobi, Kenya | Concept Cleaning';
  const description = 'Book professional residential, office, upholstery, carpet, mattress and commercial cleaning, plus pest control in Nairobi and nearby areas.';

  useEffect(() => {
    let alive = true;
    const loadFeaturedPackages = async () => {
      const now = Date.now();
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase
        .from('booking_engine_value_offers')
        .select('id,title,description,starts_at,ends_at')
        .eq('active', true)
        .eq('offer_type', 'package')
        .eq('featured', true)
        .order('display_order')
        .order('title');
      if (error) throw error;
      const current = (data || []).filter((offer) => isBookingOfferCurrent(offer, now));
      if (alive) setFeaturedPackages(current);
    };
    void loadFeaturedPackages().catch((error) => {
      console.error('Could not load published featured packages:', error);
      if (alive) setFeaturedPackages([]);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetchServiceCategories(true).then(({ data }) => {
      if (alive && data) setCategories(data);
    }).catch(() => {
      if (alive) setCategories([]);
    });
    return () => { alive = false; };
  }, []);

  const slides = [
    { eyebrow: 'CONCEPT CLEANING SERVICES', heading: 'A cleaner space starts with the right service.', copy: 'Explore professional cleaning and pest-control services for your home or workplace.', image: commercialHero, action: 'Explore services', href: '/services' },
    { eyebrow: 'BOOK WITH CONFIDENCE', heading: 'Cleaning solutions for every space.', copy: 'Compare service options, review what is included and request a booking online.', image: categoryImage('Residential Cleaning', 'residential'), action: 'Browse services', href: '/marketplace' },
    { eyebrow: 'HOME · OFFICE · COMMERCIAL', heading: 'Professional care. Clear service choices.', copy: 'Find the right cleaning option for your property and get support from our team.', image: categoryImage('Upholstery Cleaning', 'upholstery'), action: 'View packages', href: '/packages' },
  ];

  useEffect(() => {
    if (carouselPaused) return;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % slides.length), 5500);
    return () => window.clearInterval(timer);
  }, [carouselPaused, slides.length]);

  const slide = slides[activeSlide];

  return (
    <div className="ccs-jumia-home relative isolate min-h-screen overflow-hidden bg-[#f1f1f2] text-[#313133]">
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
      </Helmet>

      <style>{`
        .ccs-jumia-home { --ccs-orange:#f68b1e; --ccs-ink:#282828; --ccs-muted:#75757a; --ccs-line:#e8e8e8; }
        .ccs-jumia-home .market-catalogue { background:transparent; }
        .ccs-jumia-home .market-catalogue > section { margin:0 auto 14px; max-width:1280px; background:#fff; padding-left:20px; padding-right:20px; }
        .ccs-jumia-home .market-catalogue > section:first-child { background:#fff; color:#282828; padding-top:28px; padding-bottom:28px; }
        .ccs-jumia-home .market-catalogue > section:first-child h1 { color:#282828; }
        .ccs-jumia-home .market-catalogue > section:first-child p { color:#666; }
        .ccs-jumia-home .market-catalogue > section:nth-child(2) { padding-top:26px; padding-bottom:28px; }
        .ccs-jumia-home .market-catalogue > section:nth-child(2) a { border-radius:5px; box-shadow:0 1px 4px rgba(0,0,0,.07); }
        .ccs-jumia-home .market-catalogue > section:nth-child(2) a:hover { border-color:#f68b1e; box-shadow:0 3px 12px rgba(0,0,0,.12); }
        .ccs-jumia-home .market-catalogue > section:nth-child(2) a h2 { color:#282828; }
        .ccs-jumia-home .market-catalogue > section:nth-child(2) a span { color:#d97706; }
        .ccs-jumia-home .ccs-product-card { border:1px solid #eee; background:white; transition:box-shadow .18s ease,transform .18s ease; }
        .ccs-jumia-home .ccs-product-card:hover { transform:translateY(-2px); box-shadow:0 5px 16px rgba(0,0,0,.12); }
        .ccs-jumia-home .ccs-orange { background:#f68b1e; }
        .ccs-jumia-home .ccs-promo-track { display:flex; width:max-content; min-width:200%; animation:ccs-promo-marquee 24s linear infinite; }
        .ccs-jumia-home .ccs-promo-track:hover { animation-play-state:paused; }
        .ccs-jumia-home .ccs-background-marquee { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; gap:18px; overflow:hidden; }
        .ccs-jumia-home .ccs-background-track { display:flex; width:max-content; min-width:200%; flex:0 0 34vh; animation:ccs-background-scroll 58s linear infinite; }
        .ccs-jumia-home .ccs-background-track:nth-child(2) { animation-duration:72s; animation-direction:reverse; }
        .ccs-jumia-home .ccs-background-track img { width:clamp(190px,24vw,340px); height:100%; flex:0 0 auto; object-fit:cover; filter:saturate(.72); }
        .ccs-jumia-home .ccs-background-track:hover { animation-play-state:paused; }
        @keyframes ccs-background-scroll { from { transform:translateX(0); } to { transform:translateX(-50%); } }
        @keyframes ccs-promo-marquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
        .ccs-jumia-home .ccs-pulse { animation:ccs-pulse 2.2s ease-in-out infinite; }
        .ccs-jumia-home .ccs-hover-info { opacity:0; visibility:hidden; transform:translateY(7px); transition:opacity .18s ease,transform .18s ease,visibility .18s; }
        .ccs-jumia-home .ccs-info-trigger:hover .ccs-hover-info, .ccs-jumia-home .ccs-info-trigger:focus-within .ccs-hover-info { opacity:1; visibility:visible; transform:translateY(0); }
        @keyframes ccs-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(246,139,30,.35); } 50% { box-shadow:0 0 0 8px rgba(246,139,30,0); } }
        @media (max-width:1023px) {
          .ccs-jumia-home .ccs-market-hero { grid-template-columns:190px minmax(0,1fr); }
          .ccs-jumia-home .ccs-side-promos { display:none; }
        }
        @media (max-width:767px) {
          .ccs-jumia-home .ccs-market-hero { grid-template-columns:1fr; }
          .ccs-jumia-home .ccs-market-sidebar { display:none; }
          .ccs-jumia-home .ccs-side-promos { display:none; }
        }
        @media (prefers-reduced-motion:reduce) {
          .ccs-jumia-home *, .ccs-jumia-home *::before, .ccs-jumia-home *::after { transition-duration:.01ms !important; animation-duration:.01ms !important; }
          .ccs-jumia-home .ccs-pulse, .ccs-jumia-home .ccs-promo-track { animation:none !important; }
        }
      `}</style>

      <div aria-hidden="true" className="ccs-background-marquee pointer-events-none fixed inset-0 z-0 opacity-[0.22]">
        {[0, 1].map((row) => (
          <div key={row} className="ccs-background-track">
            {[...landingBackgroundImages, ...landingBackgroundImages].map((item, index) => (
              <img key={row + '-' + item.key + '-' + index} src={item.src} alt="" loading="lazy" />
            ))}
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/75 to-white/85" />
      </div>

      <div className="relative z-20 bg-[#f68b1e] text-white">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-1.5 text-[11px] font-semibold sm:px-6">
          <span className="tracking-wide">CONCEPT CLEANING SERVICES · NAIROBI</span>
          <div className="flex items-center gap-4">
            <a href={`tel:${phone}`} className="hidden sm:inline">{phone}</a>
            <Link to="/customer-auth?next=/my">My Account</Link>
            <a href="/admin">Staff Login</a>
          </div>
        </div>
      </div>

      {discount.active && (
        <div className="relative z-30 flex h-12 items-center overflow-hidden bg-[#111018] text-white shadow-sm" aria-label={`${discount.label || 'Special offer'}: ${discount.percentage}% off all services`}>
          <div className="ccs-promo-track items-center whitespace-nowrap">
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex min-w-[50vw] items-center justify-around gap-8 px-8 text-sm font-extrabold sm:gap-12">
                <span className="tracking-[.12em]">CONCEPT ✦</span>
                <span className="text-lg font-black text-[#ff6b1a] sm:text-xl">{discount.label || 'SPECIAL OFFERS'}</span>
                <span className="text-xs font-black tracking-wide sm:text-sm">{discount.percentage}% OFF ALL SERVICES</span>
                <Link to="/marketplace" tabIndex={copy === 1 ? -1 : 0} className="rounded-full bg-white px-5 py-2 text-xs font-black tracking-wider text-[#282828] transition-colors hover:bg-[#ff6b1a] hover:text-white">SHOP THE OFFER <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>
                <span className="rounded-full bg-[#f68b1e] px-3 py-1 text-[10px] font-black tracking-widest">LIVE NOW</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-[#e7e7e7] bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6 lg:gap-7">
          <Link to="/" className="flex w-[190px] shrink-0 items-center gap-2" aria-label={company + ' home'}>
            <img src={logo} alt={company + ' logo'} className="h-12 w-12 object-contain" />
            <span className="min-w-0"><strong className="block text-[14px] leading-4 text-[#282828]">CONCEPT CLEANING</strong><span className="text-[10px] font-semibold uppercase tracking-wider text-[#777]">Services · Nairobi</span></span>
          </Link>
          <form action="/marketplace" method="get" className="flex min-w-0 flex-1">
            <label htmlFor="ccs-market-search" className="sr-only">Search cleaning services</label>
            <input id="ccs-market-search" name="q" placeholder="Search for cleaning services, pest control and more..." className="h-11 min-w-0 flex-1 rounded-l-md border border-[#bdbdbd] bg-white px-4 text-sm outline-none focus:border-[#f68b1e] focus:ring-1 focus:ring-[#f68b1e]" />
            <button className="ccs-orange flex h-11 shrink-0 items-center gap-2 rounded-r-md px-4 text-sm font-bold text-white hover:bg-[#e77d10] sm:px-7" type="submit"><Search className="h-4 w-4" /><span className="hidden sm:inline">SEARCH</span></button>
          </form>
          <div className="hidden shrink-0 items-center gap-5 lg:flex">
            <Link to="/customer-auth?next=/my" className="flex items-center gap-2 text-sm font-semibold hover:text-[#e77d10]"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#f5f5f5]">👤</span>Account</Link>
            <a href={waHome} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-semibold hover:text-[#e77d10]"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#f5f5f5]">?</span>Help</a>
            <Link to="/marketplace" className="flex items-center gap-2 text-sm font-semibold hover:text-[#e77d10]"><CalendarDays className="h-5 w-5" />Book</Link>
          </div>
          <button type="button" className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#eee] lg:hidden" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(v => !v)}>{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {mobileMenuOpen && <nav className="grid gap-1 border-t bg-white px-4 py-3 lg:hidden"><Link to="/services" className="rounded px-3 py-2 text-sm font-semibold">All Services</Link><Link to="/packages" className="rounded px-3 py-2 text-sm font-semibold">Packages</Link><Link to="/marketplace" className="rounded px-3 py-2 text-sm font-semibold">Book Online</Link><Link to="/blog" className="rounded px-3 py-2 text-sm font-semibold">Cleaning Guides</Link><Link to="/contact" className="rounded px-3 py-2 text-sm font-semibold">Contact</Link></nav>}
      </header>

      <main className="relative z-10 mx-auto max-w-[1280px] px-2 pb-12 pt-3 sm:px-4">
        <div className="mb-3 hidden items-center gap-5 rounded bg-white px-4 py-2 text-xs font-semibold text-[#555] md:flex">
          <Link to="/services" className="text-[#e77d10]">All Services</Link><Link to="/services">Cleaning Services</Link><Link to="/packages">Packages</Link><Link to="/marketplace">Book Online</Link><Link to="/blog">Cleaning Guides</Link><Link to="/contact">Contact</Link>
          <span className="ml-auto text-[#888]">Professional cleaning · Nairobi, Kenya</span>
        </div>

        <section className="ccs-market-hero grid min-h-[360px] grid-cols-[220px_minmax(0,1fr)_205px] gap-3">
          <aside className="ccs-market-sidebar overflow-hidden rounded bg-white shadow-sm">
            <div className="border-b border-[#eee] px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-[#333]">Browse Categories</div>
            <div className="py-1">
              {categories.slice(0, 10).map((category) => (
                <Link key={category.id} to={'/services/category/' + encodeURIComponent(category.id) + '/' + slugify(category.name)} className="flex items-center justify-between gap-2 px-4 py-[9px] text-[12px] font-medium text-[#444] hover:bg-[#fff5eb] hover:text-[#d97706]">
                  <span className="truncate">{category.name}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#aaa]" />
                </Link>
              ))}
              {categories.length === 0 && <Link to="/services" className="block px-4 py-3 text-xs text-[#555]">Browse all cleaning and pest-control services</Link>}
            </div>
            <Link to="/services" className="mx-3 mb-3 mt-1 flex items-center justify-center rounded border border-[#f0a24e] py-2 text-xs font-bold text-[#d97706] hover:bg-[#fff5eb]">View all categories <ArrowRight className="ml-2 h-3.5 w-3.5" /></Link>
          </aside>

          <div className="relative min-h-[360px] overflow-hidden rounded bg-[#303943] shadow-sm" onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)} onFocus={() => setCarouselPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setCarouselPaused(false); }}>
            <img src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#14202b]/90 via-[#14202b]/55 to-transparent" />
            <div className="relative flex min-h-[360px] max-w-[650px] flex-col items-start justify-center px-7 py-8 text-white sm:px-10">
              <p className="rounded bg-white/15 px-3 py-1.5 text-[10px] font-extrabold tracking-[.16em]">{slide.eyebrow}</p>
              <h1 className="mt-4 max-w-xl text-3xl font-black leading-tight sm:text-4xl lg:text-[42px]">{slide.heading}</h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/90">{slide.copy}</p>
              <Link to={slide.href} className="ccs-pulse mt-6 inline-flex items-center rounded bg-[#f68b1e] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#e77d10]">{slide.action}<ArrowRight className="ml-2 h-4 w-4" /></Link>
            </div>
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2">
              {slides.map((item, index) => <button key={item.heading} type="button" aria-label={'Show banner ' + (index + 1)} aria-pressed={activeSlide === index} onClick={() => setActiveSlide(index)} className={`h-2 rounded-full transition-all ${activeSlide === index ? 'w-7 bg-[#f68b1e]' : 'w-2 bg-white/70'}`} />)}
            </div>
          </div>

          <aside className="ccs-side-promos grid grid-rows-2 gap-3">
            <div className="ccs-info-trigger group relative flex flex-col justify-between rounded bg-white p-4 shadow-sm transition-shadow hover:shadow-lg">
              <div className="flex items-center gap-2 text-[#d97706]"><Headphones className="h-6 w-6" /><span className="text-[11px] font-extrabold uppercase">Need assistance?</span></div>
              <div><p className="text-lg font-black leading-tight text-[#333]">Talk to our team</p><p className="mt-1 text-xs leading-5 text-[#777]">Get help choosing the right service for your property.</p></div><div className="ccs-hover-info pointer-events-none absolute inset-x-2 top-full z-50 rounded-b bg-white p-3 text-xs text-[#555] shadow-xl">Ask about service options, property requirements and booking availability.</div>
              <a href={waHome} target="_blank" rel="noopener noreferrer" className="text-xs font-extrabold text-[#d97706]">CHAT ON WHATSAPP <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></a>
            </div>
            <div className="flex flex-col justify-between rounded bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-[#d97706]"><ShieldCheck className="h-6 w-6" /><span className="text-[11px] font-extrabold uppercase">Professional care</span></div>
              <div><p className="text-lg font-black leading-tight text-[#333]">Home & business</p><p className="mt-1 text-xs leading-5 text-[#777]">Cleaning and pest-control options for different spaces.</p></div>
              <Link to="/services" className="text-xs font-extrabold text-[#d97706]">EXPLORE SERVICES <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>
            </div>
          </aside>
        </section>

        <section className="mt-3 grid grid-cols-2 gap-2 rounded bg-white p-3 shadow-sm sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: 'Residential', key: 'residential', href: '/services' },
            { label: 'Sofa & Upholstery', key: 'upholstery', href: '/services' },
            { label: 'Carpet & Rugs', key: 'carpet', href: '/services' },
            { label: 'Pest Control', key: 'pest', href: '/services' },
            { label: 'Commercial', key: 'commercial', href: '/services' },
            { label: 'Car Interior', key: 'car', href: '/services' },
          ].map((item) => (
            <Link key={item.label} to={item.href} className="group flex items-center gap-2 rounded border border-[#eee] p-2 hover:border-[#f3a34d] hover:bg-[#fffaf4]">
              <img src={categoryImage(item.label, item.key)} alt="" className="h-12 w-12 rounded object-cover" loading="lazy" />
              <span className="text-[11px] font-bold leading-4 text-[#444] group-hover:text-[#d97706]">{item.label}</span>
            </Link>
          ))}
        </section>

        <section id="booking" className="mt-3 rounded bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#d97706]">Smart service search</p><h2 className="mt-1 text-lg font-black text-[#333] sm:text-xl">What cleaning service are you looking for?</h2></div>
            <Link to="/marketplace" className="text-xs font-bold text-[#d97706]">Open marketplace <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>
          </div>
          <BookingEngine phone={phone} />
        </section>

        {featuredPackages.length > 0 && (
          <section id="featured-packages" className="mt-3 rounded bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#d97706]">Curated cleaning combinations</p>
                <h2 className="mt-1 text-xl font-black text-[#282828] sm:text-2xl">Featured Packages</h2>
                <p className="mt-1 text-xs text-[#777]">Explore published packages and request a quotation.</p>
              </div>
              <Link to="/packages" className="text-xs font-extrabold text-[#d97706] hover:underline">VIEW ALL PACKAGES <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featuredPackages.map((item) => (
                <article key={item.id} className="group overflow-hidden rounded-lg border border-[#e9e9e9] bg-white transition duration-200 hover:-translate-y-1 hover:border-[#f3a34d] hover:shadow-lg">
                  <div className="flex min-h-32 items-center justify-center bg-gradient-to-br from-[#fff4e6] via-[#ffe4c2] to-[#ffd29a] px-5 py-6 text-center">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.18em] text-[#9a580e]">Published package</p>
                      <p className="mt-2 text-xl font-black leading-tight tracking-tight text-[#242424]">{item.title}</p>
                    </div>
                  </div>
                  <div className="p-4">
                    {item.description && <p className="min-h-10 text-xs leading-5 text-[#666]">{item.description}</p>}
                    <p className="mt-3 rounded-md bg-[#fff7ed] px-3 py-2 text-xs font-semibold text-[#333]">Quotation required · Final scope confirmed by our team</p>
                    <Link to="/packages" className="mt-3 inline-flex items-center text-xs font-extrabold text-[#d97706] hover:underline">Explore package <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="market-catalogue mt-3"><ServicesCatalogueContent /></div>

        <section className="mt-3 rounded bg-white px-5 py-7 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3"><Headphones className="h-8 w-8 shrink-0 text-[#e88924]" /><span><strong className="block text-sm">Customer Support</strong><span className="text-xs text-[#777]">Help with your service request</span></span></div>
            <div className="flex items-center gap-3"><ShieldCheck className="h-8 w-8 shrink-0 text-[#e88924]" /><span><strong className="block text-sm">Professional Service</strong><span className="text-xs text-[#777]">Careful, service-focused teams</span></span></div>
            <div className="flex items-center gap-3"><CalendarDays className="h-8 w-8 shrink-0 text-[#e88924]" /><span><strong className="block text-sm">Flexible Requests</strong><span className="text-xs text-[#777]">Tell us your preferred schedule</span></span></div>
            <div className="flex items-center gap-3"><MapPin className="h-8 w-8 shrink-0 text-[#e88924]" /><span><strong className="block text-sm">Nairobi Coverage</strong><span className="text-xs text-[#777]">Nairobi and selected nearby areas</span></span></div>
          </div>
        </section>

        <section className="mt-3 flex flex-col justify-between gap-4 rounded bg-[#f68b1e] px-5 py-7 text-white sm:flex-row sm:items-center">
          <div><h2 className="text-xl font-black sm:text-2xl">Ready to book a cleaning service?</h2><p className="mt-1 text-sm text-white/90">Browse the catalogue or speak to our team for guidance.</p></div>
          <div className="flex flex-wrap gap-2"><a href={waHome} target="_blank" rel="noopener noreferrer" className="rounded bg-white px-4 py-2.5 text-sm font-bold text-[#333]">WhatsApp Us</a><Link to="/marketplace" className="rounded border border-white/70 px-4 py-2.5 text-sm font-bold text-white">Book Online</Link></div>
        </section>

        <footer className="mt-3 rounded bg-[#282828] px-5 py-8 text-white">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div><p className="font-extrabold tracking-tight">CONCEPT CLEANING SERVICES</p><p className="mt-1 text-sm text-white/65">Professional cleaning and pest control in Nairobi, Kenya.</p><SocialLinks /><p className="mt-2 text-xs text-white/45">© {new Date().getFullYear()} Concept Cleaning Services.</p></div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-white/75"><Link to="/services">Services</Link><Link to="/packages">Packages</Link><Link to="/about">About Us</Link><Link to="/contact">Contact</Link><Link to="/blog">Blog</Link><Link to="/customer-auth?next=/my">Customer account</Link><Link to="/privacy-policy">Privacy</Link><Link to="/terms-and-conditions">Terms</Link><a href="/admin">Staff login</a><a href={`tel:${phone}`}>Call us</a></div>
          </div>
        </footer>
      </main>
      <a href={waHome} target="_blank" rel="noopener noreferrer" aria-label="Chat with Concept Cleaning on WhatsApp" className="ccs-pulse fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-[#20b858] px-4 py-3 text-sm font-extrabold text-white shadow-xl transition-transform hover:-translate-y-1 hover:bg-[#159447]"><MessageCircle className="h-5 w-5" /><span className="hidden sm:inline">Chat on WhatsApp</span></a>
    </div>
  );
}
