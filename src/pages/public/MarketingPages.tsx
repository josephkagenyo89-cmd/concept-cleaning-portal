import { useEffect, useState, type ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, NavLink, useParams } from 'react-router-dom';
import {
  ArrowRight, CheckCircle2, Image as ImageIcon, Mail,
  MapPin, Menu, MessageCircle, Phone, Sparkles, X
} from 'lucide-react';
import conceptLogo from '@/assets/concept-cleaning-logo.png';
import { Button } from '@/components/ui/button';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import { waLink } from '@/components/public/PublicShell';
import { categoryImage } from '@/lib/marketplace';
import { fetchServiceCategories, type ServiceCategory } from '@/lib/serviceCategories';
import { supabase } from '@/integrations/supabase/client';

const SITE_URL = 'https://www.conceptcleaningservices.co.ke';

type SeoProps = {
  title: string;
  description: string;
  path: string;
  schema: Record<string, unknown>;
};

function PageSeo({ title, description, path, schema }: SeoProps) {
  const canonical = SITE_URL + path;
  const jsonLd = JSON.stringify(schema).replace(/</g, '\\u003c');

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index,follow,max-image-preview:large" />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={SITE_URL + '/og-image.png'} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={SITE_URL + '/og-image.png'} />
      <script type="application/ld+json">{jsonLd}</script>
    </Helmet>
  );
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About Us' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/contact', label: 'Contact' },
];

function MarketingLayout({ children }: { children: ReactNode }) {
  const { general } = usePublicSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const company = general.company_name || 'Concept Cleaning Services';
  const phone = general.phone || '+254796563741';
  const email = general.email || 'info@conceptcleaning.co.ke';
  const whatsapp = waLink(phone, 'Hello Concept Cleaning Services, I would like to enquire about your services.');

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#172033]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={company + ' home'}>
            <img src={general.logo_url || conceptLogo} alt={company + ' logo'} className="h-10 w-10 shrink-0 rounded-xl object-contain" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold tracking-tight sm:text-base">CONCEPT CLEANING</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Services · Nairobi</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold lg:flex" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => 'transition-colors hover:text-teal-700 ' + (isActive ? 'text-teal-700' : 'text-slate-600')}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-800">
              <Link to="/marketplace">Customer booking</Link>
            </Button>
            <Button asChild className="bg-teal-700 text-white hover:bg-teal-800">
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 lg:hidden"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <nav className="grid gap-1 border-t border-slate-200 bg-white px-4 py-3 lg:hidden" aria-label="Mobile navigation">
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {item.label}
              </Link>
            ))}
            <Link to="/marketplace" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-teal-700">
              Book a service
            </Link>
          </nav>
        )}
      </header>

      <main>{children}</main>

      <footer className="mt-16 bg-[#102A2A] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <p className="text-lg font-extrabold">{company}</p>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/70">
              Professional residential, commercial, upholstery, carpet, car interior cleaning and pest-control services in Nairobi and surrounding areas.
            </p>
            <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-teal-200">
              Return to homepage <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div>
            <p className="font-bold">Explore</p>
            <ul className="mt-3 space-y-2 text-sm text-white/75">
              <li><Link to="/services" className="hover:text-white">Cleaning services</Link></li>
              <li><Link to="/about" className="hover:text-white">About us</Link></li>
              <li><Link to="/gallery" className="hover:text-white">Gallery</Link></li>
              <li><Link to="/blog" className="hover:text-white">Cleaning guides</Link></li>
              <li><Link to="/marketplace" className="hover:text-white">Book online</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold">Contact</p>
            <ul className="mt-3 space-y-3 text-sm text-white/75">
              <li className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0" /><a href={'tel:' + phone} className="hover:text-white">{phone}</a></li>
              <li className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0" /><a href={'mailto:' + email} className="break-all hover:text-white">{email}</a></li>
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{general.address || 'Nairobi, Kenya'}</li>
            </ul>
          </div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs text-white/55">
          © {new Date().getFullYear()} {company}. All rights reserved.
        </p>
      </footer>
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-slate-200 bg-white text-teal-800 sm:hidden">
        <a href={'tel:' + phone} className="flex flex-col items-center gap-1 py-2 text-xs font-semibold"><Phone className="h-5 w-5" />Call</a>
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 py-2 text-xs font-semibold"><MessageCircle className="h-5 w-5" />WhatsApp</a>
        <Link to="/marketplace" className="flex flex-col items-center gap-1 bg-teal-700 py-2 text-xs font-bold text-white"><Sparkles className="h-5 w-5" />Book now</Link>
      </div>
    </div>
  );
}

function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="bg-[#0B3D3B] px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-teal-200">{eyebrow}</p>
        <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-white/80 sm:text-base">{description}</p>
      </div>
    </section>
  );
}

function PageCta({ title, description }: { title: string; description: string }) {
  const { general } = usePublicSettings();
  const phone = general.phone || '+254796563741';
  const href = waLink(phone, 'Hello Concept Cleaning Services, ' + description);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-5 rounded-3xl bg-teal-700 p-7 text-white sm:p-10 lg:flex-row lg:items-center">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/80">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="bg-white text-teal-800 hover:bg-teal-50"><Link to="/marketplace">Book a service <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          <Button asChild variant="outline" className="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white"><a href={href} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp us</a></Button>
        </div>
      </div>
    </section>
  );
}

type PublicService = {
  id: string;
  name: string;
  slug: string | null;
  short_description: string | null;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
};

function ServiceCard({ service, category }: { service: PublicService; category: ServiceCategory }) {
  const image = service.image_url || categoryImage(category.name, category.image_key);
  const summary = service.short_description || service.description || 'View the service description, available details and booking options.';

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <Link to={'/service/' + encodeURIComponent(service.slug || service.id)} className="block">
        <img src={image} alt={service.name} loading="lazy" className="h-48 w-full object-cover" />
      </Link>
      <div className="p-5">
        <h3 className="text-lg font-extrabold leading-snug text-slate-900">
          <Link to={'/service/' + encodeURIComponent(service.slug || service.id)} className="hover:text-teal-700">{service.name}</Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{summary}</p>
        <Link to={'/service/' + encodeURIComponent(service.slug || service.id)} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-teal-900">
          View service <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function categorySlug(name: string) {
  return name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function categoryPurpose(category: ServiceCategory) {
  if (category.description?.trim()) return category.description.trim();
  const name = category.name.toLowerCase();
  if (/residential|house|home|domestic/.test(name)) return 'Designed for the regular care and detailed cleaning of living spaces. Explore services that help maintain cleaner rooms, kitchens, bathrooms and household surfaces, with options suited to different home sizes and cleaning needs.';
  if (/commercial|office|business|industrial/.test(name)) return 'For workplaces and business premises that need a clean, orderly and welcoming environment. Explore cleaning options for offices, shared areas and commercial spaces, with service choices based on the property and its day-to-day requirements.';
  if (/upholstery|sofa|furniture/.test(name)) return 'Focused on the fabric and surfaces of upholstered furniture. Explore services for sofas, seats and other soft furnishings to address embedded dust, everyday marks and accumulated dirt while taking the material into account.';
  if (/carpet|rug/.test(name)) return 'For carpets and rugs that collect dust, grit and everyday stains through regular use. Explore suitable cleaning options to refresh floor coverings and improve the cleanliness of the rooms in which they are used.';
  if (/mattress|bed/.test(name)) return 'Focused on the cleaning and care of mattresses and sleeping surfaces. Explore options for addressing accumulated dust, marks and everyday soiling as part of a cleaner, more comfortable bedroom.';
  if (/car|vehicle|auto|detailing/.test(name)) return 'For the interior spaces and surfaces of vehicles. Explore cleaning options for seats, carpets, mats, dashboards and other interior areas, with attention to the materials and surfaces that need care.';
  if (/pest|fumig|cockroach|bedbug|rodent|termite/.test(name)) return 'For properties that need professional pest management. Explore the available inspection, treatment and prevention services for common household or business pest concerns, and choose the option that matches the pest issue and property.';
  return 'Explore the services grouped under ' + category.name + '. This category helps you compare the available options for the relevant space, surface or cleaning requirement, review each service’s details and choose the most suitable next step for your property.';
}

function CategoryCard({ category }: { category: ServiceCategory }) {
  return (
    <Link
      to={'/services/category/' + encodeURIComponent(category.id) + '/' + categorySlug(category.name)}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <img src={categoryImage(category.name, category.image_key)} alt="" loading="lazy" className="h-52 w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
      <div className="p-6">
        <h2 className="text-xl font-black text-slate-900 group-hover:text-teal-700">{category.name}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{categoryPurpose(category)}</p>
        <span className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-teal-700">Explore category <ArrowRight className="h-4 w-4" /></span>
      </div>
    </Link>
  );
}

export function ServicesPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadCategories = async () => {
      const { data, error: queryError } = await (supabase.from('services') as any)
        .select('category')
        .eq('is_active', true)
        .not('category', 'is', null)
        .order('category', { ascending: true })
        .limit(191);

      if (!mounted) return;
      if (queryError) {
        setError('The service categories are temporarily unavailable. Please try again shortly or contact our team.');
      } else {
        setCategories(Array.from(new Set(
          (data || [])
            .map((row: { category: string | null }) => String(row.category || '').trim())
            .filter(Boolean)
        )));
      }
      setLoading(false);
    };

    void loadCategories().catch(() => {
      if (mounted) {
        setError('The service categories are temporarily unavailable. Please try again shortly or contact our team.');
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Cleaning and Pest-Control Service Categories in Nairobi',
    description: 'Browse the active cleaning and pest-control service categories offered by Concept Cleaning Services in Nairobi and surrounding areas.',
    url: SITE_URL + '/services',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: categories.map((category, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: category,
      })),
    },
  };

  return (
    <MarketingLayout>
      <PageSeo
        title="Cleaning & Pest-Control Categories in Nairobi | Concept Cleaning Services"
        description="Browse active cleaning and pest-control service categories from Concept Cleaning Services in Nairobi."
        path="/services"
        schema={schema}
      />
      <PageHero
        eyebrow="Our services"
        title="Explore our cleaning and pest-control categories"
        description="Browse the service categories currently available in our active services catalogue."
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Browse by category</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Available service categories</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">These categories are taken directly from active services in our catalogue.</p>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading service categories…</div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">{error}</div>
        ) : categories.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">No active service categories are currently available.</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category}
                to={'/services/category/legacy-' + encodeURIComponent(category) + '/' + categorySlug(category)}
                className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <img src={categoryImage(category)} alt="" loading="lazy" className="h-48 w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
                <div className="p-5">
                  <h2 className="text-lg font-black text-slate-900 group-hover:text-teal-700">{category}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Explore the cleaning and property-care services available under {category}.</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-teal-700">Explore services <ArrowRight className="h-4 w-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <PageCta title="Need help choosing a service?" description="I would like help finding the right cleaning or pest-control service for my property." />
    </MarketingLayout>
  );
}

export function ServiceCategoryPage() {
  const { categoryId = '', categorySlug: routeSlug = '' } = useParams();
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');

      const isLegacyCategory = categoryId.startsWith('legacy-');
      let selected: ServiceCategory | null = null;

      if (isLegacyCategory) {
        const categoryName = categoryId.slice('legacy-'.length).trim();
        if (categoryName) {
          selected = {
            id: categoryId,
            name: categoryName,
            description: null,
            sort_order: 0,
            is_active: true,
            image_key: '',
          };
        }
      } else {
        const categoryResult = await fetchServiceCategories(true);
        if (categoryResult.error) throw categoryResult.error;
        selected = (categoryResult.data || []).find((item) => item.id === categoryId) || null;
      }

      if (!selected) {
        if (mounted) { setCategory(null); setServices([]); setLoading(false); }
        return;
      }

      let serviceQuery = (supabase.from('services') as any)
        .select('id,name,slug,short_description,description,image_url,category_id')
        .eq('is_active', true);

      serviceQuery = isLegacyCategory
        ? serviceQuery.eq('category', selected.name)
        : serviceQuery.eq('category_id', selected.id);

      const { data, error: serviceError } = await serviceQuery.order('name', { ascending: true });
      if (serviceError) throw serviceError;

      if (mounted) {
        setCategory(selected);
        setServices((data || []) as PublicService[]);
        setLoading(false);
      }
    };
    void load().catch(() => {
      if (mounted) {
        setError('This category could not be loaded right now. Please try again shortly or contact our team.');
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [categoryId]);

  useEffect(() => {
    if (category && routeSlug !== categorySlug(category.name)) {
      const categoryPathId = category.id.startsWith('legacy-')
        ? 'legacy-' + encodeURIComponent(category.name)
        : encodeURIComponent(category.id);
      window.history.replaceState(null, '', '/services/category/' + categoryPathId + '/' + categorySlug(category.name));
    }
  }, [category, routeSlug]);

  const description = category ? categoryPurpose(category) : '';
  const canonicalCategoryId = category
    ? (category.id.startsWith('legacy-') ? 'legacy-' + encodeURIComponent(category.name) : encodeURIComponent(category.id))
    : '';
  const canonicalPath = category ? '/services/category/' + canonicalCategoryId + '/' + categorySlug(category.name) : '/services';
  const schema = category ? {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name + ' Services in Nairobi | Concept Cleaning Services',
    description,
    url: SITE_URL + canonicalPath,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: services.map((service, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: service.name,
        url: SITE_URL + '/service/' + encodeURIComponent(service.slug || service.id),
      })),
    },
  } : { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Service category' };

  return (
    <MarketingLayout>
      {category && <PageSeo
        title={category.name + ' Services in Nairobi | Concept Cleaning Services'}
        description={description}
        path={canonicalPath}
        schema={schema}
      />}
      {loading ? (
        <section className="mx-auto max-w-7xl px-4 py-20 text-sm text-slate-600">Loading category…</section>
      ) : error ? (
        <section role="alert" className="mx-auto max-w-7xl px-4 py-20 text-sm text-amber-900">{error}</section>
      ) : !category ? (
        <section className="mx-auto max-w-7xl px-4 py-20">
          <h1 className="text-2xl font-black text-slate-900">Category not found</h1>
          <p className="mt-3 text-sm text-slate-600">This category may no longer be available.</p>
          <Link to="/services" className="mt-5 inline-flex items-center gap-2 font-bold text-teal-700">Browse all categories <ArrowRight className="h-4 w-4" /></Link>
        </section>
      ) : (
        <>
          <PageHero eyebrow="Service category" title={category.name} description={description} />
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Available in this category</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">Explore {category.name}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
              </div>
              <Link to="/services" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700"><ArrowRight className="h-4 w-4 rotate-180" /> All categories</Link>
            </div>
            {services.length ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => <ServiceCard key={service.id} service={service} category={category} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-8">
                <h3 className="font-extrabold text-slate-900">Services are being updated</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">There are no active services listed in this category at the moment. Contact our team if you need help with this type of service.</p>
                <Link to="/contact" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-teal-700">Contact our team <ArrowRight className="h-4 w-4" /></Link>
              </div>
            )}
          </section>
          <PageCta title={'Need help with ' + category.name.toLowerCase() + '?'} description={'I would like help choosing a ' + category.name.toLowerCase() + ' service.'} />
        </>
      )}
    </MarketingLayout>
  );
}

export function AboutPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Concept Cleaning Services',
    description: 'Learn about Concept Cleaning Services and its cleaning and pest-control services in Nairobi, Kenya.',
    url: SITE_URL + '/about',
    about: { '@type': 'Organization', name: 'Concept Cleaning Services', url: SITE_URL + '/' },
  };

  return (
    <MarketingLayout>
      <PageSeo
        title="About Concept Cleaning Services | Nairobi, Kenya"
        description="Learn about Concept Cleaning Services, our professional cleaning approach, service standards and residential and commercial cleaning solutions in Nairobi."
        path="/about"
        schema={schema}
      />
      <PageHero
        eyebrow="About Concept Cleaning Services"
        title="Professional care for the spaces where life and business happen"
        description="Concept Cleaning Services provides cleaning and pest-control services for residential and commercial properties in Nairobi and surrounding areas."
      />
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Who we are</p>
          <h2 className="mt-3 text-2xl font-black text-slate-900 sm:text-3xl">A considered approach to cleaning and property care</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Concept Cleaning Services brings together residential cleaning, commercial cleaning, specialist upholstery and carpet care, car interior detailing, fumigation and pest-control services.
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Our approach is to understand the space and the service required, explain the available service information and help customers choose an appropriate booking or quotation option.
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            We serve customers in Nairobi and confirmed surrounding service areas in Kiambu, Kajiado and Machakos counties.
          </p>
          <Button asChild className="mt-7 bg-teal-700 text-white hover:bg-teal-800"><Link to="/services">Explore our services <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
        <div className="rounded-3xl bg-[#E7F2F1] p-7 sm:p-9">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-800">Our service approach</p>
          <div className="mt-6 space-y-6">
            {[
              ['Understand the requirement', 'Identify the property, space and type of cleaning or pest-control service needed.'],
              ['Review the service details', 'Use the service catalogue to check descriptions, listed features and available booking information.'],
              ['Arrange the next step', 'Submit a booking request or contact the team if you need help selecting a service.'],
            ].map(([heading, text], index) => (
              <div key={heading} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-black text-white">{index + 1}</span>
                <div><h3 className="font-extrabold text-slate-900">{heading}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black text-slate-900">Where we serve</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">Our service coverage includes Nairobi and selected areas in neighbouring counties. Availability can depend on the service and the property location, so contact us to confirm coverage for a specific request.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {['Nairobi', 'Kiambu', 'Kajiado', 'Machakos'].map((area) => <div key={area} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><MapPin className="h-5 w-5 text-teal-700" /><span className="font-bold text-slate-800">{area}</span></div>)}
          </div>
        </div>
      </section>
      <PageCta title="Find the right service for your property" description="I would like to learn more about Concept Cleaning Services and available services." />
    </MarketingLayout>
  );
}

type GalleryItem = { url: string; alt: string; serviceName: string };

function normalizeGalleryImages(value: unknown, serviceName: string, serviceImageUrl?: string | null): GalleryItem[] {
  let items: unknown[] = [];
  if (Array.isArray(value)) items = value;
  else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      items = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      items = [value];
    }
  } else if (value && typeof value === 'object') {
    items = Object.values(value as Record<string, unknown>);
  }
  if (serviceImageUrl) items.unshift(serviceImageUrl);

  const seen = new Set<string>();
  return items.flatMap((item) => {
    const record: Record<string, unknown> = typeof item === 'string' ? { url: item } : (item && typeof item === 'object' ? item as Record<string, unknown> : {});
    const url = String(record.url || record.src || record.image_url || '').trim();
    if (!url || (!/^https?:\/\//i.test(url) && !/^\/(?!\/)/.test(url)) || seen.has(url)) return [];
    seen.add(url);
    return [{
      url,
      alt: String(record.alt || record.title || (serviceName + ' cleaning service')).trim(),
      serviceName,
    }];
  });
}

export function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data, error: queryError } = await (supabase.from('services') as any)
        .select('name,image_url,gallery_images')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (!mounted) return;
      if (queryError) {
        setError(true);
      } else {
        const gallery = (data || []).flatMap((service: { name: string; image_url: string | null; gallery_images: unknown }) =>
          normalizeGalleryImages(service.gallery_images, service.name, service.image_url)
        );
        setItems(gallery);
      }
      setLoading(false);
    };
    void load().catch(() => {
      if (mounted) {
        setError(true);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Cleaning Projects Gallery | Concept Cleaning Services',
    description: 'A gallery of cleaning project images supplied for Concept Cleaning Services.',
    url: SITE_URL + '/gallery',
    mainEntity: {
      '@type': 'ImageGallery',
      image: items.map((item) => ({ '@type': 'ImageObject', contentUrl: item.url, caption: item.alt })),
    },
  };

  return (
    <MarketingLayout>
      <PageSeo
        title="Cleaning Projects & Gallery | Concept Cleaning Services Nairobi"
        description="Explore cleaning project photographs from Concept Cleaning Services, including residential, upholstery, carpet and specialist cleaning work."
        path="/gallery"
        schema={schema}
      />
      <PageHero
        eyebrow="Our gallery"
        title="A closer look at our cleaning work"
        description="Browse photographs attached to our service records. Each image is shown with its related service so you can explore the work and find the right service for your property."
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <ImageIcon className="h-6 w-6 text-teal-700" />
          <div><h2 className="text-2xl font-black text-slate-900">Project photographs</h2><p className="mt-1 text-sm text-slate-600">Images are sourced from the existing service gallery records.</p></div>
        </div>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Loading gallery photographs…</div>
        ) : error ? (
          <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">The gallery could not be loaded right now. Please try again later.</div>
        ) : items.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <figure key={item.url + '-' + index} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <img src={item.url} alt={item.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                <figcaption className="p-4"><p className="font-bold text-slate-900">{item.serviceName}</p><p className="mt-1 text-sm text-slate-600">{item.alt}</p></figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-9 text-center">
            <ImageIcon className="mx-auto h-9 w-9 text-slate-400" />
            <h3 className="mt-4 text-lg font-extrabold text-slate-900">Project photographs are being added</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">The existing service records do not currently contain gallery photographs available for this page. Explore the service catalogue to learn about the work we offer.</p>
            <Button asChild className="mt-5 bg-teal-700 text-white hover:bg-teal-800"><Link to="/services">Explore services <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        )}
      </section>
      <PageCta title="Have a cleaning project in mind?" description="I would like to discuss a cleaning or pest-control service for my property." />
    </MarketingLayout>
  );
}

export function ContactPage() {
  const { general } = usePublicSettings();
  const phone = general.phone || '+254796563741';
  const email = general.email || 'info@conceptcleaning.co.ke';
  const address = general.address || 'Nairobi, Kenya';
  const whatsapp = waLink(phone, 'Hello Concept Cleaning Services, I would like to enquire about a cleaning or pest-control service.');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact Concept Cleaning Services',
    description: 'Contact Concept Cleaning Services for cleaning and pest-control enquiries in Nairobi and surrounding areas.',
    url: SITE_URL + '/contact',
    mainEntity: {
      '@type': 'Organization',
      name: general.company_name || 'Concept Cleaning Services',
      url: SITE_URL + '/',
      telephone: phone,
      email,
      address: { '@type': 'PostalAddress', addressLocality: address, addressCountry: 'KE' },
    },
  };

  return (
    <MarketingLayout>
      <PageSeo
        title="Contact Concept Cleaning Services | Nairobi"
        description="Contact Concept Cleaning Services to arrange professional home, office, upholstery and pest-control services in Nairobi and surrounding areas."
        path="/contact"
        schema={schema}
      />
      <PageHero
        eyebrow="Contact our team"
        title="Let's discuss the cleaning service you need"
        description="Get in touch with Concept Cleaning Services to ask about available services, arrange a booking or request guidance on the right option for your property."
      />
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Contact details</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">Use the contact details below to reach the team. For service requests, you can also browse the catalogue and submit a booking request online.</p>
          <div className="mt-7 space-y-4">
            <a href={'tel:' + phone} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-teal-300">
              <Phone className="mt-1 h-5 w-5 text-teal-700" /><span><span className="block font-extrabold text-slate-900">Call us</span><span className="mt-1 block text-sm text-slate-600">{phone}</span></span>
            </a>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-teal-300">
              <MessageCircle className="mt-1 h-5 w-5 text-teal-700" /><span><span className="block font-extrabold text-slate-900">WhatsApp</span><span className="mt-1 block text-sm text-slate-600">Send an enquiry or discuss your service requirements.</span></span>
            </a>
            <a href={'mailto:' + email} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 hover:border-teal-300">
              <Mail className="mt-1 h-5 w-5 text-teal-700" /><span><span className="block font-extrabold text-slate-900">Email</span><span className="mt-1 block break-all text-sm text-slate-600">{email}</span></span>
            </a>
            <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5">
              <MapPin className="mt-1 h-5 w-5 text-teal-700" /><span><span className="block font-extrabold text-slate-900">Service base</span><span className="mt-1 block text-sm text-slate-600">{address}</span></span>
            </div>
          </div>
        </div>
        <div className="rounded-3xl bg-[#E7F2F1] p-7 sm:p-9">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-800">Service coverage</p>
          <h2 className="mt-3 text-2xl font-black text-slate-900">Nairobi and surrounding areas</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">Our service coverage includes Nairobi, selected parts of Kiambu, Kajiado and Machakos. Availability depends on the service and exact location, so please contact us to confirm your area.</p>
          <ul className="mt-6 space-y-3 text-sm text-slate-700">
            {['Westlands', 'Kilimani', 'Karen', 'Lavington', 'Runda', 'Ruaka', 'Ruiru', 'Thika', 'Kitengela', 'Ongata Rongai'].map((area) => <li key={area} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-teal-700" />{area}</li>)}
          </ul>
          <Button asChild className="mt-8 bg-teal-700 text-white hover:bg-teal-800"><Link to="/marketplace">Start a booking <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
      </section>
      <PageCta title="Prefer to speak with us first?" description="I would like to talk to your team about my cleaning or pest-control requirements." />
    </MarketingLayout>
  );
}

export function HomeGalleryPreview() {
  const [items, setItems] = useState<GalleryItem[]>([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data } = await (supabase.from('services') as any)
        .select('name,image_url,gallery_images')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (!mounted) return;
      setItems((data || []).flatMap((service: { name: string; image_url: string | null; gallery_images: unknown }) =>
        normalizeGalleryImages(service.gallery_images, service.name, service.image_url)
      ).slice(0, 3));
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <section id="gallery" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-teal-700">Our gallery</p><h2 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">A look at our cleaning work</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Explore photographs attached to the services in our existing catalogue.</p></div>
          <Link to="/gallery" className="inline-flex items-center gap-2 text-sm font-bold text-teal-700">View gallery <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {items.length ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {items.map((item) => <Link key={item.url} to="/gallery" className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><img src={item.url} alt={item.alt} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" /><p className="p-4 text-sm font-bold text-slate-800">{item.serviceName}</p></Link>)}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><p className="text-sm text-slate-600">Project photographs will appear here as they are added to the service gallery.</p><Link to="/gallery" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-teal-700">Visit the gallery page <ArrowRight className="h-4 w-4" /></Link></div>
        )}
      </div>
    </section>
  );
}
