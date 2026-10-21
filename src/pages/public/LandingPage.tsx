import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Home, LayoutGrid, User, MessageCircle, Gift, Receipt, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PublicShell, { waLink } from '@/components/public/PublicShell';
import GlobalDiscountBanner from '@/components/marketplace/GlobalDiscountBanner';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { BlogPost, fetchPublishedPosts, readingTime } from '@/lib/blog';

const SOFT_KEY = 'ccs_soft_signin_dismissed';

const FLOW = [
  { title: 'Choose a service', text: 'Browse by type of clean or fumigation.', to: '/marketplace' },
  { title: 'See the price', text: 'Discounts are shown on every service.', to: '/marketplace' },
  { title: 'Book or request a quote', text: 'Sign in with Google once, then confirm.', to: '/marketplace' },
  { title: 'Pay after the job', text: 'M-Pesa, with an official invoice and receipt.', to: '/my/bookings' },
];

const CATEGORIES = [
  { title: 'Home cleaning', text: 'Deep and move-in cleans' },
  { title: 'Sofa and carpet', text: 'Fabric-safe shampoo' },
  { title: 'Fumigation', text: 'Pests with warranty revisit' },
  { title: 'Office', text: 'Priced by quote' },
];

const FAQS = [
  { q: 'How soon can you come?', a: 'Most bookings are served within 24 to 48 hours.' },
  { q: 'Is fumigation safe for children and pets?', a: 'We use approved products and tell you how long to keep people and pets out.' },
  { q: 'How do I pay?', a: 'By M-Pesa after the job. You receive an official invoice and receipt.' },
  { q: 'Can I change my date?', a: 'Yes. Message us at least one day before.' },
];

/** Bottom tabs: Home, Services, Account, WhatsApp. Shown on every screen size. */
function BottomTabs({ onAccount, waHref }: { onAccount: () => void; waHref: string }) {
  const tab = 'flex min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-bold text-brand-slate';
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-sand bg-white">
      <div className="mx-auto grid max-w-[430px] grid-cols-4 px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2">
        <Link to="/" className={tab}><Home className="h-[22px] w-[22px]" />Home</Link>
        <Link to="/marketplace" className={tab}><LayoutGrid className="h-[22px] w-[22px]" />Services</Link>
        <button type="button" onClick={onAccount} className={tab}><User className="h-[22px] w-[22px]" />Account</button>
        <a href={waHref} target="_blank" rel="noopener noreferrer" className={`${tab} !text-[#1F7A4D]`}><MessageCircle className="h-[22px] w-[22px]" />WhatsApp</a>
      </div>
    </nav>
  );
}

/** Account sheet. Signed-in clients get Track my booking; everyone else gets Google sign-in. */
function AccountSheet({ open, onClose, signedIn }: { open: boolean; onClose: () => void; signedIn: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-brand-forest/40 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your account"
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-brand-sand" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-brand-ink">{signedIn ? 'Hello again' : 'Your account'}</h2>
          <button type="button" onClick={onClose} aria-label="Close account" className="rounded-full p-1.5 text-brand-slate"><X className="h-5 w-5" /></button>
        </div>
        {signedIn ? (
          <div className="mt-4 grid gap-3">
            <p className="text-sm text-brand-slate">Everything you have booked, in one place.</p>
            <Button asChild className="bg-brand-brass text-brand-forest hover:bg-brand-brass/90">
              <Link to="/my/bookings" onClick={onClose}>Track my booking</Link>
            </Button>
            <Button asChild variant="outline" className="border-brand-sand">
              <Link to="/my/documents" onClick={onClose}><Receipt className="mr-2 h-4 w-4" />Invoices and receipts</Link>
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
  const waHome = waLink(phone, 'Hello Concept Cleaning Services, I would like to book a cleaning.');
  const waQuote = waLink(phone, 'Hello Concept Cleaning Services, I would like a free quote.');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [softOpen, setSoftOpen] = useState(false);
  const [softHidden, setSoftHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(SOFT_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    fetchPublishedPosts(3).then(setPosts).catch(() => setPosts([]));
  }, []);

  const dismissSoft = () => {
    setSoftHidden(true);
    try { localStorage.setItem(SOFT_KEY, '1'); } catch { /* storage unavailable: hide for this visit only */ }
  };

  const title = 'Concept Cleaning Services | Professional Cleaning in Nairobi, Kenya';
  const desc = 'Trusted home, office, carpet, sofa and fumigation services in Nairobi. Vetted crews, clear prices, M-Pesa payment. Book online or get a WhatsApp quote today.';

  const headerWhatsApp = (
    <a
      href={waHome}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1F7A4D] px-3 py-2 text-xs font-bold text-white hover:bg-[#186540] md:text-sm"
    >
      <MessageCircle className="h-4 w-4" /> WhatsApp
    </a>
  );

  return (
    <PublicShell headerExtra={headerWhatsApp} hideMobileBar>
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

      <GlobalDiscountBanner />

      <div className="min-h-screen bg-brand-paper pb-28 text-brand-ink md:py-6">
        <div className="mx-auto max-w-[430px] bg-white md:overflow-hidden md:rounded-[28px] md:border md:border-brand-sand md:shadow-xl">
          <div className="space-y-6 px-4 pb-6 pt-4">

            {/* Soft sign-in suggestion: a suggestion, never a gate */}
            {!user && !softHidden && (
              <div className="rounded-xl border border-brand-sand bg-[#faf9f5]">
                <button
                  type="button"
                  onClick={() => setSoftOpen((v) => !v)}
                  aria-expanded={softOpen}
                  className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left text-[13px] font-semibold text-brand-slate"
                >
                  Save your bookings and invoices
                  <ChevronDown className={`h-4 w-4 transition-transform ${softOpen ? 'rotate-180' : ''}`} />
                </button>
                {softOpen && (
                  <div className="border-t border-brand-sand px-4 pb-4 pt-3 text-[13px] text-brand-slate">
                    <p>Sign in with Google to see your bookings, quotations and receipts in one place. You can still browse and book without it.</p>
                    <div className="mt-3 flex flex-col gap-2">
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
            )}

            {/* Hero */}
            <section className="rounded-2xl bg-brand-forest p-5 text-brand-cream">
              <h1 className="text-2xl font-extrabold leading-tight">Book a clean in Nairobi</h1>
              <p className="mt-2 text-sm text-brand-mist">See the price first, choose a date, and pay with M-Pesa after the job. Quotations are free.</p>
              <Button asChild size="lg" className="mt-4 w-full bg-brand-brass text-brand-forest hover:bg-brand-brass/90">
                <Link to="/marketplace">Browse services and prices</Link>
              </Button>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <Button asChild variant="outline" className="border-brand-outline bg-transparent text-brand-cream hover:bg-brand-panel hover:text-brand-cream">
                  <Link to="/categories">Categories</Link>
                </Button>
                <Button asChild variant="outline" className="border-brand-outline bg-transparent text-brand-cream hover:bg-brand-panel hover:text-brand-cream">
                  <a href={waQuote} target="_blank" rel="noopener noreferrer">Get a quote</a>
                </Button>
              </div>
            </section>

            {/* Booking steps */}
            <section>
              <h2 className="mb-3 text-[17px] font-extrabold">How booking works</h2>
              <div className="grid gap-2">
                {FLOW.map((s, i) => (
                  <Link key={s.title} to={s.to} className="flex items-center gap-3 rounded-2xl border border-brand-sand bg-white p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-forest text-[13px] font-extrabold text-white">{i + 1}</span>
                    <span>
                      <span className="block text-sm font-bold">{s.title}</span>
                      <span className="text-xs text-brand-slate">{s.text}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            {/* Categories */}
            <section>
              <h2 className="mb-3 text-[17px] font-extrabold">What do you need cleaned?</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {CATEGORIES.map((c) => (
                  <Link key={c.title} to="/categories" className="rounded-2xl border border-brand-sand bg-white p-3.5 text-sm font-bold">
                    {c.title}
                    <span className="mt-0.5 block text-xs font-medium text-brand-slate">{c.text}</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* Referral */}
            <section className="flex items-center gap-3 rounded-2xl border border-brand-sand bg-white p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-sand text-brand-brassDark"><Gift className="h-5 w-5" /></span>
              <div className="flex-1">
                <p className="text-[15px] font-bold">Refer a friend</p>
                <p className="text-xs text-brand-slate">Share your code and both of you save on the next clean.</p>
              </div>
              <Link to="/marketplace" className="shrink-0 rounded-xl bg-brand-forest px-3 py-2.5 text-[13px] font-bold text-white">Refer</Link>
            </section>

            {/* Blog: live posts from the database */}
            {posts.length > 0 && (
              <section>
                <h2 className="mb-3 text-[17px] font-extrabold">From our blog</h2>
                <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-2">
                  {posts.map((p) => (
                    <Link key={p.id} to={`/blog/${p.slug}`} className="w-[200px] shrink-0 rounded-2xl border border-brand-sand bg-white p-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-brand-brassDark">{p.category}</p>
                      <p className="mt-1 text-sm font-extrabold leading-snug">{p.title}</p>
                      <p className="mt-1 text-xs text-brand-slate">{readingTime(p.content)} min read</p>
                    </Link>
                  ))}
                </div>
                <Link to="/blog" className="text-[13px] font-bold text-brand-brassDark">All posts →</Link>
              </section>
            )}

            {/* Questions */}
            <section>
              <h2 className="mb-2 text-[17px] font-extrabold">Questions</h2>
              {FAQS.map((f, i) => (
                <details key={f.q} open={i === 0} className="border-b border-brand-sand py-3">
                  <summary className="cursor-pointer list-none text-sm font-bold">{f.q}</summary>
                  <p className="mt-2 text-[13px] text-brand-slate">{f.a}</p>
                </details>
              ))}
            </section>

            <p className="pt-2 text-center text-xs text-brand-slate">
              <Link to="/privacy-policy" className="underline-offset-4 hover:underline">Privacy</Link> ·{' '}
              <Link to="/terms-and-conditions" className="underline-offset-4 hover:underline">Terms</Link> ·{' '}
              <a href={`tel:${phone}`} className="underline-offset-4 hover:underline">Call {phone}</a>
            </p>
          </div>
        </div>
      </div>

      <BottomTabs onAccount={() => setAccountOpen(true)} waHref={waHome} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} signedIn={!!user && isCustomer} />
    </PublicShell>
  );
}
