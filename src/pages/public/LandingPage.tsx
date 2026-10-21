import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ShieldCheck, Leaf, Clock, FileCheck2, Star, ArrowRight, MessageCircle, MapPin,
  Search, CalendarCheck, Sparkles, BadgeCheck, Home, LayoutGrid, User, Gift, Receipt, X, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import PublicShell, { waLink } from '@/components/public/PublicShell';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import GlobalDiscountBanner from '@/components/marketplace/GlobalDiscountBanner';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { BlogPost, fetchPublishedPosts, fmtBlogDate, readingTime } from '@/lib/blog';
import { MarketService, fetchMarketServicesLimited } from '@/lib/marketplace';
import residential from '@/assets/market/residential.jpg';
import commercial from '@/assets/market/commercial.jpg';
import carpet from '@/assets/market/carpet.jpg';
import upholstery from '@/assets/market/upholstery.jpg';
import car from '@/assets/market/car.jpg';
import pest from '@/assets/market/pest.jpg';

const SERVICES = [
  { name: 'Home Deep Cleaning', desc: 'Kitchens, bathrooms, move-in / move-out and post-construction cleans.', img: residential },
  { name: 'Office & Commercial', desc: 'Offices, shops, schools and facilities on daily or scheduled contracts.', img: commercial },
  { name: 'Carpet Cleaning', desc: 'Hot-water extraction that lifts deep dirt, stains and odours.', img: carpet },
  { name: 'Sofa & Upholstery', desc: 'Fabric-safe shampooing for sofas, mattresses and chairs.', img: upholstery },
  { name: 'Car Interior Detailing', desc: 'Seats, mats, roof lining and dashboard detailing at your location.', img: car },
  { name: 'Fumigation & Pest Control', desc: 'Bedbugs, cockroaches, termites and rodents with warranty revisits.', img: pest },
];

const PILLARS = [
  { icon: ShieldCheck, title: 'Vetted, trained crew', text: 'Every technician is background-checked and trained on our standards.' },
  { icon: Leaf, title: 'Safe products', text: 'Approved, family- and pet-friendly chemicals used correctly.' },
  { icon: Clock, title: 'On time, every time', text: 'We confirm your slot and arrive ready with our own equipment.' },
  { icon: FileCheck2, title: 'Proper paperwork', text: 'Official quotation, invoice, receipt and completion certificate.' },
];

const STEPS = [
  { icon: Search, title: 'Choose a service', text: 'Browse services and see clear prices.' },
  { icon: CalendarCheck, title: 'Book or get a quote', text: 'Pick a date online or chat with us on WhatsApp.' },
  { icon: Sparkles, title: 'We do the work', text: 'Our team arrives fully equipped and gets it done.' },
  { icon: BadgeCheck, title: 'Inspect & pay', text: 'Check the result, then pay by M-Pesa.' },
];

const AREAS = ['Westlands', 'Kilimani', 'Kileleshwa', 'Lavington', 'Karen', 'Runda', 'Parklands', 'South B', 'South C', 'Langata', 'Ruaka', 'Kiambu Road', 'Thika Road', 'Ruiru', 'Syokimau', 'Kitengela', 'Ongata Rongai', 'Embakasi'];

const FAQS = [
  { q: 'Which areas do you serve?', a: 'We serve all of Nairobi and nearby towns including Kiambu, Ruiru, Thika Road, Syokimau, Kitengela and Rongai.' },
  { q: 'Is fumigation safe for children and pets?', a: 'Yes. We use approved products and give you clear safety instructions, including how long to stay out of treated rooms.' },
  { q: 'How soon can you come?', a: 'Most bookings can be served within 24–48 hours. Contact us on WhatsApp for urgent jobs.' },
  { q: 'How do I pay?', a: 'You pay by M-Pesa or bank transfer after the job. You get an official invoice and receipt.' },
  { q: 'Do you bring your own equipment?', a: 'Yes. Our team brings all machines, tools and cleaning products needed.' },
];

const SOFT_KEY = 'ccs_soft_signin_dismissed';

/** Bottom app bar for phones: Home, Services, Account, WhatsApp. Hidden on laptops. */
function MobileAppBar({ onAccount, waHref }: { onAccount: () => void; waHref: string }) {
  const item = 'flex min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-semibold text-brand-slate';
  return (
    <nav aria-label="App navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-brand-sand bg-white px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 md:hidden">
      <Link to="/" className={item}><Home className="h-5 w-5" />Home</Link>
      <Link to="/marketplace" className={item}><LayoutGrid className="h-5 w-5" />Services</Link>
      <button type="button" onClick={onAccount} className={item}><User className="h-5 w-5" />Account</button>
      <a href={waHref} target="_blank" rel="noopener noreferrer" className={`${item} !text-[#1F7A4D]`}><MessageCircle className="h-5 w-5" />WhatsApp</a>
    </nav>
  );
}

/** Account sheet: Track my booking lives here for signed-in clients. */
function AccountSheet({ open, onClose, signedIn }: { open: boolean; onClose: () => void; signedIn: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-brand-forest/40 transition-opacity md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your account"
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl transition-transform duration-300 md:hidden ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-brand-sand" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-ink">Your account</h2>
          <button type="button" onClick={onClose} aria-label="Close account" className="rounded-full p-1.5 text-brand-slate"><X className="h-5 w-5" /></button>
        </div>

        {signedIn ? (
          <div className="mt-4 grid gap-3">
            <Button asChild className="bg-brand-brass text-brand-forest hover:bg-brand-brass/90">
              <Link to="/my/bookings" onClick={onClose}>Track my booking</Link>
            </Button>
            <Button asChild variant="outline" className="border-brand-sand">
              <Link to="/my/documents" onClick={onClose}><Receipt className="mr-2 h-4 w-4" />Invoices and receipts</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/my" onClick={onClose}>Account home</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <p className="text-sm text-brand-slate">Sign in with Google to track bookings, invoices and receipts.</p>
            <Button asChild variant="outline" className="border-brand-sand bg-white text-brand-ink">
              <Link to="/customer-auth?next=/my" onClick={onClose}>Continue with Google</Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

export default function LandingPage() {
  const { settings } = useSettings();
  const { user, isCustomer } = useAuth();
  const phone = settings.general.phone || '+254796563741';
  const reviewUrl = (settings as any).feedback?.google_review_url || 'https://g.page/r/CYJAstog5dgWEBI/review';
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [quickBookingServices, setQuickBookingServices] = useState<MarketService[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [softOpen, setSoftOpen] = useState(false);
  const [softHidden, setSoftHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(SOFT_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => { fetchPublishedPosts(3).then(setPosts); }, []);

  useEffect(() => {
    let active = true;

    fetchMarketServicesLimited(6)
      .then((services) => {
        if (!active) return;

        const preferredCategories = [
          'Upholstery Cleaning',
          'Fumigation & Pest Control',
          'Residential Cleaning',
          'Carpet & Rug Cleaning',
        ];

        const selected: MarketService[] = [];
        const seen = new Set<string>();

        preferredCategories.forEach((category) => {
          const match = services.find((service) => {
            if (service.category !== category) return false;
            const key = `${service.category}:${service.id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          if (match) selected.push(match);
        });

        if (selected.length < 4) {
          services.forEach((service) => {
            const key = `${service.category}:${service.id}`;
            if (seen.has(key)) return;
            selected.push(service);
            seen.add(key);
          });
        }

        setQuickBookingServices(selected.slice(0, 4));
      })
      .catch(() => setQuickBookingServices([]));

    return () => { active = false; };
  }, []);

  const dismissSoft = () => {
    setSoftHidden(true);
    try { localStorage.setItem(SOFT_KEY, '1'); } catch { /* storage unavailable: hide for this visit only */ }
  };

  const title = 'Concept Cleaning Services | Professional Cleaning in Nairobi, Kenya';
  const desc = 'Trusted home, office, carpet, sofa and fumigation services in Nairobi. Vetted crews, clear prices, M-Pesa payment. Book online or get a WhatsApp quote today.';
  const waQuote = waLink(phone, 'Hello Concept Cleaning Services, I would like a free quote.');
  const headerWhatsApp = (
    <a
      href={waLink(phone, 'Hello Concept Cleaning Services, I would like to book a cleaning.')}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1F7A4D] px-3 py-2 text-xs font-bold text-white hover:bg-[#186540] md:text-sm"
    >
      <MessageCircle className="h-4 w-4" /> WhatsApp
    </a>
  );

  return (
    <PublicShell headerExtra={headerWhatsApp} hideMobileBar>
      <GlobalDiscountBanner />

      <div className="bg-brand-paper font-['Manrope',sans-serif] text-brand-ink pb-20 md:pb-0">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href="https://www.conceptcleaningservices.co.ke/" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        })}</script>
      </Helmet>

      {/* Soft sign-in suggestion: a suggestion, never a gate. Hidden for signed-in users and after dismissal. */}
      {!user && !softHidden && (
        <div className="mx-auto max-w-6xl px-4 pt-4 md:px-6">
          <div className="rounded-xl border border-brand-sand bg-white">
            <button
              type="button"
              onClick={() => setSoftOpen((v) => !v)}
              aria-expanded={softOpen}
              className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-brand-slate"
            >
              Save your bookings and invoices
              <ChevronDown className={`h-4 w-4 transition-transform ${softOpen ? 'rotate-180' : ''}`} />
            </button>
            {softOpen && (
              <div className="border-t border-brand-sand px-4 pb-4 pt-3 text-sm text-brand-slate">
                <p>Sign in with Google to see your bookings, quotations and receipts in one place. You can still browse and book without it.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button asChild variant="outline" className="border-brand-sand bg-white text-brand-ink">
                    <Link to="/customer-auth?next=/my">Continue with Google</Link>
                  </Button>
                  <button type="button" onClick={dismissSoft} className="min-h-[44px] text-sm text-brand-slate underline-offset-4 hover:underline">
                    Maybe later
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-forest text-brand-cream">
        <img src={residential} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-brand-forest/90 via-brand-forest/75 to-brand-forest/65" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 lg:gap-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-panel px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-brass">
              <Star className="h-3.5 w-3.5 fill-current" /> Trusted cleaning team in Nairobi
            </p>
            <h1 className="mt-4 text-3xl font-extrabold leading-[1.15] sm:text-4xl md:text-5xl lg:text-6xl">
              Cleaner homes. <br className="hidden sm:block" />Healthier businesses.
            </h1>
            <p className="mt-4 max-w-lg text-base text-brand-mist md:text-lg">
              Vetted cleaners, clear pricing, and professional results for homes, offices, carpets, sofas and pest control across Nairobi, with fast booking and easy M-Pesa payment.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-brand-brass text-brand-forest hover:bg-brand-brass/90">
                <Link to="/marketplace">Browse services & prices <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-brand-outline bg-transparent text-brand-cream hover:bg-brand-panel hover:text-brand-cream">
                <a href={waQuote} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1 h-4 w-4" /> Get a free quote
                </a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-sm text-brand-mist sm:gap-3">
              <span className="rounded-full border border-brand-line bg-brand-panel/60 px-3 py-1">4.9★ rated</span>
              <span className="rounded-full border border-brand-line bg-brand-panel/60 px-3 py-1">24–48h booking</span>
              <span className="rounded-full border border-brand-line bg-brand-panel/60 px-3 py-1">M-Pesa payment</span>
            </div>
          </div>

          <div className="rounded-[28px] border border-brand-line bg-white/10 p-4 shadow-2xl backdrop-blur-sm">
            <div className="rounded-2xl bg-brand-panel px-4 py-3 text-brand-cream">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-brass">Quick booking</p>
              <h2 className="mt-2 text-xl font-bold">Book your next clean in under 2 minutes</h2>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {quickBookingServices.length > 0 ? (
                quickBookingServices.map((service) => {
                  const directLink = `/service/${service.slug || service.id}`;

                  return (
                    <Link
                      key={`${service.category}:${service.id}`}
                      to={directLink}
                      className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-brand-cream transition hover:bg-white/10"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-brass" />
                      <span className="line-clamp-1">{service.name}</span>
                    </Link>
                  );
                })
              ) : (
                <Link to="/categories" className="col-span-full flex min-h-[44px] items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-brand-cream">
                  Browse all service categories
                </Link>
              )}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button asChild className="bg-brand-brass text-brand-forest hover:bg-brand-brass/90">
                <Link to="/marketplace">Book now</Link>
              </Button>
              <Button asChild variant="outline" className="border-brand-outline bg-transparent text-brand-cream hover:bg-brand-panel hover:text-brand-cream">
                <a href={waLink(phone, 'Hello Concept Cleaning Services, I need a quick quote.')} target="_blank" rel="noopener noreferrer">WhatsApp quote</a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            {PILLARS.map((p) => (
              <div key={p.title} className="rounded-xl border border-brand-line bg-brand-panel p-4 text-brand-cream shadow-lg">
                <p.icon className="h-6 w-6 text-brand-brass" />
                <p className="mt-2 text-sm font-semibold">{p.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-brand-line bg-brand-forest">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-8 text-center md:grid-cols-4 md:px-6">
          {[['5,000+', 'Spaces cleaned'], ['4.9★', 'Google rating'], ['24–48h', 'Typical booking'], ['100%', 'Satisfaction focus']].map(([v, l]) => (
            <div key={l}><p className="text-2xl font-extrabold text-brand-brass md:text-3xl">{v}</p><p className="text-xs text-brand-mist md:text-sm">{l}</p></div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-14" aria-labelledby="services-h">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="services-h" className="text-2xl font-bold text-brand-ink md:text-3xl">Cleaning & fumigation services in Nairobi</h2>
            <p className="mt-2 text-brand-slate">Pick what you need. Prices are shown upfront.</p>
          </div>
          <Link to="/marketplace" className="hidden shrink-0 text-sm font-semibold text-brand-brassDark md:inline-flex">View all →</Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <Link key={s.name} to="/marketplace" className="group overflow-hidden rounded-2xl border border-brand-sand bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
              <ServiceVisual image={s.img} alt={`${s.name} in Nairobi`} className="aspect-[16/10] w-full object-cover" />
              <div className="p-5">
                <h3 className="font-semibold text-brand-ink">{s.name}</h3>
                <p className="mt-1 text-sm text-brand-slate">{s.desc}</p>
                <p className="mt-3 text-sm font-semibold text-brand-brassDark">Book now →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Referral */}
      <section className="mx-auto max-w-6xl px-4 pb-4 md:px-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-brand-sand bg-white p-5 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-sand text-brand-brassDark"><Gift className="h-5 w-5" /></span>
          <div className="flex-1">
            <h2 className="font-semibold text-brand-ink">Refer a friend</h2>
            <p className="text-sm text-brand-slate">Share your code and you both save on the next clean.</p>
          </div>
          <Button asChild variant="outline" className="shrink-0 border-brand-brassDark text-brand-ink">
            <Link to="/marketplace">Refer now</Link>
          </Button>
        </div>
      </section>

      {/* Why us */}
      <section className="bg-brand-sand/40">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-14">
          <h2 className="text-2xl font-bold text-brand-ink md:text-3xl">Why Nairobi chooses Concept Cleaning</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-brand-sand bg-white p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-sand text-brand-brassDark"><p.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-semibold text-brand-ink">{p.title}</h3>
                <p className="mt-1 text-sm text-brand-slate">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-14">
        <h2 className="text-2xl font-bold text-brand-ink md:text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-brand-sand bg-white p-6">
              <span className="absolute right-5 top-4 text-4xl font-extrabold text-brand-sand">{i + 1}</span>
              <s.icon className="h-6 w-6 text-brand-brassDark" />
              <h3 className="mt-3 font-semibold text-brand-ink">{s.title}</h3>
              <p className="mt-1 text-sm text-brand-slate">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Areas */}
      <section id="areas" className="bg-brand-sand/40 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-14">
          <h2 className="text-2xl font-bold text-brand-ink md:text-3xl">Areas we serve in Nairobi</h2>
          <p className="mt-2 text-brand-slate">Same professional service across the city and nearby towns.</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <li key={a} className="inline-flex items-center gap-1 rounded-full border border-brand-sand bg-white px-3 py-1.5 text-sm text-brand-ink"><MapPin className="h-3.5 w-3.5 text-brand-brassDark" />{a}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reviews */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-14">
        <div className="rounded-3xl border border-brand-sand bg-white p-6 text-center md:p-12">
          <div className="flex justify-center gap-1 text-brand-brassDark">{[...Array(5)].map((_, i) => <Star key={i} className="h-6 w-6 fill-current" />)}</div>
          <h2 className="mt-4 text-2xl font-bold text-brand-ink md:text-3xl">Loved by homes & businesses across Nairobi</h2>
          <p className="mx-auto mt-2 max-w-xl text-brand-slate">Read what our clients say on Google, and share your own experience.</p>
          <Button asChild variant="outline" className="mt-6 border-brand-brassDark text-brand-ink hover:bg-brand-sand"><a href={reviewUrl} target="_blank" rel="noopener noreferrer">Read our Google reviews</a></Button>
        </div>
      </section>

      {/* Blog */}
      {posts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12 md:px-6 md:pb-14">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold text-brand-ink md:text-3xl">Cleaning tips & guides</h2>
            <Link to="/blog" className="text-sm font-semibold text-brand-brassDark">All articles →</Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-5">
            {posts.map((p) => (
              <Link key={p.id} to={`/blog/${p.slug}`} className="overflow-hidden rounded-2xl border border-brand-sand bg-white transition hover:shadow-lg">
                {p.cover_image && <img src={p.cover_image} alt={p.title} loading="lazy" className="aspect-[16/9] w-full object-cover" />}
                <div className="p-5">
                  <p className="text-xs text-brand-slate">{p.category} · {readingTime(p.content)} min read · {fmtBlogDate(p.published_at)}</p>
                  <h3 className="mt-2 font-semibold leading-snug text-brand-ink">{p.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-6 md:px-6">
        <h2 className="text-2xl font-bold text-brand-ink md:text-3xl">Frequently asked questions</h2>
        <Accordion type="single" collapsible className="mt-6">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`f${i}`}>
              <AccordionTrigger className="text-left text-brand-ink">{f.q}</AccordionTrigger>
              <AccordionContent className="text-brand-slate">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pt-10 md:px-6">
        <div className="rounded-3xl bg-brand-forest p-7 text-center text-brand-cream md:p-14">
          <h2 className="text-2xl font-extrabold md:text-4xl">Ready for a cleaner space?</h2>
          <p className="mx-auto mt-3 max-w-lg text-brand-mist">Book in minutes or get a free quote on WhatsApp.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-brand-brass text-brand-forest hover:bg-brand-brass/90"><Link to="/marketplace">Book a Service</Link></Button>
            <Button asChild size="lg" variant="outline" className="border-brand-outline bg-transparent text-brand-cream hover:bg-brand-panel hover:text-brand-cream">
              <a href={waQuote} target="_blank" rel="noopener noreferrer">WhatsApp a quote</a>
            </Button>
          </div>
        </div>
      </section>

      <MobileAppBar onAccount={() => setAccountOpen(true)} waHref={waQuote} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} signedIn={!!user && isCustomer} />
      </div>
    </PublicShell>
  );
}
