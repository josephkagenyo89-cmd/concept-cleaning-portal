import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ShieldCheck, Leaf, Clock, FileCheck2, Star, ArrowRight, MessageCircle, MapPin,
  Search, CalendarCheck, Sparkles, BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import PublicShell, { waLink } from '@/components/public/PublicShell';
import { useSettings } from '@/hooks/useSettings';
import { BlogPost, fetchPublishedPosts, fmtBlogDate, readingTime } from '@/lib/blog';
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

export default function LandingPage() {
  const { settings } = useSettings();
  const phone = settings.general.phone || '+254796563741';
  const reviewUrl = (settings as any).feedback?.google_review_url || 'https://g.page/r/CYJAstog5dgWEBI/review';
  const [posts, setPosts] = useState<BlogPost[]>([]);

  useEffect(() => { fetchPublishedPosts(3).then(setPosts); }, []);

  const title = 'Concept Cleaning Services | Professional Cleaning in Nairobi, Kenya';
  const desc = 'Trusted home, office, carpet, sofa and fumigation services in Nairobi. Vetted crews, clear prices, M-Pesa payment. Book online or get a WhatsApp quote today.';

  return (
    <PublicShell>
      <div className="bg-brand-paper font-['Manrope',sans-serif] text-brand-ink">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href="https://conceptcleaningke.lovable.app/" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-forest text-brand-cream">
        <img src={residential} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2 md:items-center md:px-6 md:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-panel text-brand-brass px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              <Star className="h-3.5 w-3.5 fill-current" /> Rated 4.9 by Nairobi clients
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] md:text-5xl lg:text-6xl">
              Spotless spaces. <br className="hidden sm:block" />Healthier living.
            </h1>
            <p className="mt-4 max-w-lg text-base text-brand-mist md:text-lg">
              Nairobi's trusted team for home deep cleaning, office cleaning, carpets, sofas and fumigation — done right the first time.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-brand-brass text-brand-forest hover:bg-brand-brass/90">
                <Link to="/marketplace">See Services & Prices <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-brand-outline bg-transparent text-brand-cream hover:bg-brand-panel hover:text-brand-cream">
                <a href={waLink(phone, 'Hello Concept Cleaning Services, I would like a quote.')} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp Quote
                </a>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6" aria-labelledby="services-h">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="services-h" className="text-2xl font-bold text-brand-ink md:text-3xl">Cleaning & fumigation services in Nairobi</h2>
            <p className="mt-2 text-brand-slate">Pick what you need — prices are shown upfront.</p>
          </div>
          <Link to="/marketplace" className="hidden shrink-0 text-sm font-semibold text-brand-brassDark md:inline-flex">View all →</Link>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <Link key={s.name} to="/marketplace" className="group overflow-hidden rounded-2xl border border-brand-sand bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
              <img src={s.img} alt={`${s.name} in Nairobi`} loading="lazy" className="aspect-[16/10] w-full object-cover" />
              <div className="p-5">
                <h3 className="font-semibold text-brand-ink">{s.name}</h3>
                <p className="mt-1 text-sm text-brand-slate">{s.desc}</p>
                <p className="mt-3 text-sm font-semibold text-brand-brassDark">Book now →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="bg-brand-sand/40">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <h2 className="text-2xl font-bold text-brand-ink md:text-3xl">Why Nairobi chooses Concept Cleaning</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <h2 className="text-2xl font-bold text-brand-ink md:text-3xl">How it works</h2>
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <h2 className="text-2xl font-bold text-brand-ink md:text-3xl">Areas we serve in Nairobi</h2>
          <p className="mt-2 text-brand-slate">Same professional service across the city and nearby towns.</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <li key={a} className="inline-flex items-center gap-1 rounded-full border border-brand-sand bg-white text-brand-ink px-3 py-1.5 text-sm"><MapPin className="h-3.5 w-3.5 text-brand-brassDark" />{a}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reviews */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="rounded-3xl border border-brand-sand bg-white p-8 text-center md:p-12">
          <div className="flex justify-center gap-1 text-brand-brassDark">{[...Array(5)].map((_, i) => <Star key={i} className="h-6 w-6 fill-current" />)}</div>
          <h2 className="mt-4 text-2xl font-bold text-brand-ink md:text-3xl">Loved by homes & businesses across Nairobi</h2>
          <p className="mx-auto mt-2 max-w-xl text-brand-slate">Read what our clients say on Google — and share your own experience.</p>
          <Button asChild variant="outline" className="mt-6 border-brand-brassDark text-brand-ink hover:bg-brand-sand"><a href={reviewUrl} target="_blank" rel="noopener noreferrer">Read our Google reviews</a></Button>
        </div>
      </section>

      {/* Blog */}
      {posts.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-14 md:px-6">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold text-brand-ink md:text-3xl">Cleaning tips & guides</h2>
            <Link to="/blog" className="text-sm font-semibold text-brand-brassDark">All articles →</Link>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} to={`/blog/${p.slug}`} className="overflow-hidden rounded-2xl border border-brand-sand bg-white hover:shadow-lg transition">
                {p.cover_image && <img src={p.cover_image} alt={p.title} loading="lazy" className="aspect-[16/9] w-full object-cover" />}
                <div className="p-5">
                  <p className="text-xs text-brand-slate">{p.category} · {readingTime(p.content)} min read · {fmtBlogDate(p.published_at)}</p>
                  <h3 className="mt-2 font-semibold text-brand-ink leading-snug">{p.title}</h3>
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
        <div className="rounded-3xl bg-brand-forest p-8 text-center text-brand-cream md:p-14">
          <h2 className="text-2xl font-extrabold md:text-4xl">Ready for a cleaner space?</h2>
          <p className="mx-auto mt-3 max-w-lg text-brand-mist">Book in minutes or get a free quote on WhatsApp.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-brand-brass text-brand-forest hover:bg-brand-brass/90"><Link to="/marketplace">Book a Service</Link></Button>
            <Button asChild size="lg" variant="outline" className="border-brand-outline bg-transparent text-brand-cream hover:bg-brand-panel hover:text-brand-cream">
              <a href={`tel:${phone}`}>Call {phone}</a>
            </Button>
          </div>
        </div>
      </section>
      </div>
    </PublicShell>
  );
}
