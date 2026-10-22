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
import { fetchMarketCategories } from '@/lib/marketplace';

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

      <main className="min-h-screen bg-white text-[#333333]">
        <header className="sticky top-0 z-40 border-b border-[#e7e7e7] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Concept Cleaning Services home">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#333333] text-white"><Sparkles className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-extrabold tracking-tight sm:text-base">CONCEPT CLEANING</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#777777]">Services • Nairobi</span>
              </span>
            </Link>
            <nav className="hidden items-center gap-7 text-sm font-semibold text-[#555555] lg:flex" aria-label="Main navigation">
              <a href="#services" className="transition-colors hover:text-black">Our services</a>
              <a href="#how-it-works" className="transition-colors hover:text-black">How it works</a>
              <a href="#why-us" className="transition-colors hover:text-black">Why Concept</a>
              <a href="#faq" className="transition-colors hover:text-black">FAQs</a>
            </nav>
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="outline" className="border-[#d6d6d6] bg-white text-[#333333] hover:bg-[#f5f5f5]">
                <Link to="/marketplace">Browse services</Link>
              </Button>
              <Button asChild className="bg-[#333333] text-white hover:bg-black">
                <a href={waHome} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Book on WhatsApp</a>
              </Button>
            </div>
            <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#e2e2e2] sm:hidden" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(v => !v)}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
          {mobileMenuOpen && <nav className="grid gap-1 border-t border-[#eeeeee] px-4 py-3 sm:hidden" aria-label="Mobile navigation">
            <a href="#services" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">Our services</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">How it works</a>
            <a href="#why-us" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">Why Concept</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[#f5f5f5]">FAQs</a>
            <Button asChild className="mt-1 bg-[#333333] text-white hover:bg-black"><Link to="/marketplace">Browse services</Link></Button>
          </nav>}
        </header>

        <section className="relative overflow-hidden border-b border-[#ededed]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#f2f2f2] via-white to-white" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#dedede] bg-white px-3 py-1.5 text-xs font-bold text-[#555555]"><span className="h-2 w-2 rounded-full bg-[#333333]" /> CLEAN SPACES. BETTER DAYS.</span>
              <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">A cleaner space.<br /><span className="text-[#777777]">A better feeling.</span></h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#666666] sm:text-lg">Professional cleaning and pest-control services for homes, offices and the spaces that matter to you in Nairobi.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="min-h-12 bg-[#333333] px-6 text-white transition hover:-translate-y-0.5 hover:bg-black">
                  <Link to="/marketplace">Explore services & prices <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="min-h-12 border-[#d4d4d4] bg-white px-6 text-[#333333] transition hover:-translate-y-0.5 hover:bg-[#f6f6f6]">
                  <a href={waQuote} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Get a free quote</a>
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm font-medium text-[#666666]">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#333333]" /> Clear service details</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#333333]" /> Convenient booking</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#333333]" /> Home & business care</span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-3 rounded-[2rem] border border-[#e5e5e5]" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[1.7rem] bg-[#ededed] p-5 sm:p-7">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex min-h-40 flex-col justify-between rounded-2xl bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md sm:min-h-48 sm:p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0f0f0]"><Home className="h-5 w-5" /></span>
                    <div><p className="font-extrabold">Home cleaning</p><p className="mt-1 text-xs leading-5 text-[#777777]">Make room to breathe.</p></div>
                  </div>
                  <div className="mt-7 flex min-h-40 flex-col justify-between rounded-2xl bg-[#333333] p-4 text-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md sm:min-h-48 sm:p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10"><SprayCan className="h-5 w-5" /></span>
                    <div><p className="font-extrabold">Pest control</p><p className="mt-1 text-xs leading-5 text-white/70">Targeted treatment.</p></div>
                  </div>
                  <div className="-mt-4 flex min-h-40 flex-col justify-between rounded-2xl bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md sm:min-h-48 sm:p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0f0f0]"><Sofa className="h-5 w-5" /></span>
                    <div><p className="font-extrabold">Sofa & carpet</p><p className="mt-1 text-xs leading-5 text-[#777777]">Refresh the details.</p></div>
                  </div>
                  <div className="flex min-h-40 flex-col justify-between rounded-2xl bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md sm:min-h-48 sm:p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f0f0f0]"><Building2 className="h-5 w-5" /></span>
                    <div><p className="font-extrabold">Office care</p><p className="mt-1 text-xs leading-5 text-[#777777]">Ready for business.</p></div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white bg-white/80 p-4">
                  <div><p className="text-sm font-extrabold">Your space, taken care of.</p><p className="mt-1 text-xs text-[#777777]">Start with the service you need.</p></div>
                  <Link to="/marketplace" aria-label="Explore cleaning services" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#333333] text-white transition hover:scale-105"><ArrowRight className="h-4 w-4" /></Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#777777]">What we do</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">The right clean for every space.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#777777] sm:text-base">Choose a service to explore details, pricing and booking options.</p></div>
            <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4 transition hover:text-black">View all services <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service, index) => {
              const Icon = service.icon;
              const available = categories.length === 0 || categories.includes(service.category);
              return <Link key={service.title} to={available ? `/categories?c=${encodeURIComponent(service.category)}` : '/marketplace'} className="group flex min-h-52 flex-col rounded-2xl border border-[#e7e7e7] bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-[#bdbdbd] hover:shadow-[0_14px_35px_rgba(0,0,0,0.07)] sm:p-6">
                <div className="flex items-start justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3f3f3] transition duration-300 group-hover:bg-[#333333] group-hover:text-white"><Icon className="h-5 w-5" /></span><span className="text-xs font-bold text-[#aaaaaa]">0{index + 1}</span></div>
                <h3 className="mt-5 text-lg font-extrabold">{service.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-[#777777]">{service.text}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold">Explore service <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </Link>;
            })}
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-y border-[#e9e9e9] bg-[#f7f7f7]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#777777]">Simple from the start</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Book in a few clear steps.</h2></div>
            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {[{n:'01',title:'Choose what you need',text:'Browse services and check the details and available prices.'},{n:'02',title:'Share your requirements',text:'Select your service and send your booking request or ask for a quote.'},{n:'03',title:'Confirm the plan',text:'We follow up to confirm availability, service details and next steps.'}].map((step) => <div key={step.n} className="rounded-2xl border border-[#e4e4e4] bg-white p-6"><span className="text-sm font-black tracking-widest text-[#999999]">{step.n}</span><h3 className="mt-5 text-lg font-extrabold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-[#777777]">{step.text}</p></div>)}
            </div>
          </div>
        </section>

        <section id="why-us" className="scroll-mt-24 mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:items-center lg:px-8">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#777777]">Why Concept</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Care in the details.<br />Clarity at every step.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-[#777777] sm:text-base">We make it easier to find the right service for your home or business, understand what is included and know how to move forward.</p>
            <Button asChild className="mt-7 bg-[#333333] text-white hover:bg-black"><Link to="/marketplace">Find your service <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[{icon:ShieldCheck,title:'Professional approach',text:'Clear service information and practical guidance.'},{icon:Clock3,title:'Convenient booking',text:'Send a request online or talk to us directly.'},{icon:Sparkles,title:'Services for real life',text:'From everyday cleaning to detailed refreshes.'},{icon:MapPin,title:'Locally focused',text:'Serving Nairobi and selected nearby areas.'}].map((item) => { const Icon = item.icon; return <div key={item.title} className="rounded-2xl border border-[#e7e7e7] p-5"><Icon className="h-5 w-5" /><h3 className="mt-4 font-extrabold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#777777]">{item.text}</p></div>; })}
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 rounded-3xl bg-[#333333] p-7 text-white sm:p-10 lg:flex-row lg:items-center lg:p-12">
            <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">Ready when you are</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Let’s make your space feel new again.</h2><p className="mt-3 text-sm leading-6 text-white/70 sm:text-base">Browse services or tell us what you need and we’ll help you find the right next step.</p></div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="bg-white text-[#333333] hover:bg-[#eeeeee]"><Link to="/marketplace">Browse services <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"><a href={waQuote} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp us</a></Button></div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 mx-auto max-w-4xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="text-center"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#777777]">Helpful answers</p><h2 className="mt-3 text-3xl font-black tracking-tight">Frequently asked questions</h2></div>
          <div className="mt-8 divide-y divide-[#e7e7e7] border-y border-[#e7e7e7]">
            {FAQS.map((faq, i) => <div key={faq.q} className="py-1"><button type="button" aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-4 text-left font-bold"><span>{faq.q}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} /></button>{openFaq === i && <p className="max-w-3xl pb-5 pr-8 text-sm leading-6 text-[#777777]">{faq.a}</p>}</div>)}
          </div>
        </section>

        <footer className="border-t border-[#e7e7e7] bg-[#f8f8f8]">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div><p className="font-extrabold tracking-tight">CONCEPT CLEANING SERVICES</p><p className="mt-1 text-sm text-[#777777]">Professional cleaning and pest control in Nairobi, Kenya.</p><p className="mt-2 text-xs text-[#888888]">© {new Date().getFullYear()} Concept Cleaning Services.</p></div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#555555]"><Link to="/marketplace" className="hover:text-black">Services</Link><Link to="/customer-auth?next=/my" className="hover:text-black">Customer account</Link><Link to="/privacy-policy" className="hover:text-black">Privacy</Link><Link to="/terms-and-conditions" className="hover:text-black">Terms</Link><a href={`tel:${phone}`} className="hover:text-black">Call us</a></div>
          </div>
        </footer>
      </main>
    </PublicShell>
  );
}
