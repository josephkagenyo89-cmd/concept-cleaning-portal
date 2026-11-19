import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ServiceCard from '@/components/marketplace/ServiceCard';
import { MarketService, categoryImage, fetchMarketServices, groupByCategory } from '@/lib/marketplace';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import SponsoredPlacements from '@/components/public/SponsoredPlacements';
import { trackCategoryClick } from '@/lib/marketplaceBehavior';

const normalizeSearch = (value: string) =>
  value
    .toLocaleLowerCase('en')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function matchesServiceSearch(service: MarketService, query: string): boolean {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;

  const searchable = normalizeSearch([
    service.name,
    service.service_code,
    service.category,
    service.short_description,
    service.description,
    ...(Array.isArray(service.service_features) ? service.service_features : []),
  ].filter(Boolean).join(' '));
  const words = searchable.split(' ');

  // Require every search term to match, allowing partial words and common plurals.
  return terms.every((term) =>
    words.some((word) =>
      word.startsWith(term) ||
      (term.length > 3 && word.startsWith(term.replace(/s$/, '')))
    )
  );
}

export default function MarketHome() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [params] = useSearchParams();
  const searchQuery = params.get('q')?.trim() || '';

  useEffect(() => {
    let mounted = true;
    fetchMarketServices()
      .then((items) => { if (mounted) setServices(items); })
      .catch(() => { if (mounted) setLoadError(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const grouped = useMemo(() => groupByCategory(services), [services]);
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    return services.filter((service) => matchesServiceSearch(service, searchQuery));
  }, [services, searchQuery]);

  return (
    <main className="min-h-screen bg-[#FAF9F6] pb-12 text-[#292824]">
      <Helmet>
        <title>{searchQuery ? `Search: ${searchQuery} | Concept Cleaning Services` : 'Cleaning Services in Nairobi | Concept Cleaning Services'}</title>
        <meta name="description" content="Explore home, office, upholstery, carpet, car interior cleaning, fumigation and pest-control services in Nairobi and nearby areas." />
        <link rel="canonical" href="https://www.conceptcleaningservices.co.ke/marketplace" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://www.conceptcleaningservices.co.ke/marketplace" />
        <meta property="og:title" content="Cleaning Services in Nairobi | Concept Cleaning Services" />
        <meta property="og:description" content="Explore home, office, upholstery, carpet, car interior cleaning, fumigation and pest-control services in Nairobi and nearby areas." />
        <meta property="og:image" content="https://www.conceptcleaningservices.co.ke/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Cleaning Services in Nairobi | Concept Cleaning Services" />
        <meta name="twitter:description" content="Explore home, office, upholstery, carpet, car interior cleaning, fumigation and pest-control services in Nairobi and nearby areas." />
        <meta name="twitter:image" content="https://www.conceptcleaningservices.co.ke/og-image.png" />
      </Helmet>
      <section className="mx-auto max-w-7xl px-4 pb-9 pt-7 md:px-8 md:pb-12 md:pt-11">
        <div className="mb-6 flex items-end justify-between gap-3 md:mb-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9A7A43] sm:text-xs">Concept Cleaning Services</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#292824] sm:text-3xl md:text-4xl">
              {searchQuery ? 'Search results' : 'Explore our services'}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#77736B]">
              {searchQuery ? `Services matching “${searchQuery}”. Search by service name, code, category or description.` : 'Thoughtful care for your home, workplace and surroundings.'}
            </p>
          </div>
          {searchQuery ? (
            <Link to="/marketplace" className="shrink-0 rounded-full border border-[#D5B779] bg-white px-4 py-2 text-xs font-semibold text-[#8A6B35] transition hover:bg-[#FBF5E9]">
              Clear search
            </Link>
          ) : !loading && grouped.length > 0 ? (
            <span className="hidden rounded-full border border-[#E7E1D5] bg-white px-4 py-2 text-xs font-semibold text-[#77736B] sm:inline-flex">{grouped.length} categories</span>
          ) : null}
        </div>

        {searchQuery && !loading && <div className="mb-6"><SponsoredPlacements placementKey="search_featured" serviceIds={searchResults.map((service) => service.id)} /></div>}
        {!searchQuery && <div className="mb-6"><SponsoredPlacements placementKey="marketplace_featured" /></div>}

        {searchQuery ? (
          loading ? (
            <p className="rounded-2xl border border-[#E9E5DC] bg-white p-5 text-sm text-[#77736B]">Searching the service catalogue…</p>
          ) : loadError ? (
            <p className="rounded-2xl border border-[#E9E5DC] bg-white p-5 text-sm text-[#77736B]">Services could not be loaded. Please refresh and try again.</p>
          ) : searchResults.length ? (
            <>
              <p className="mb-4 text-xs font-medium text-[#918B80]">{searchResults.length} matching {searchResults.length === 1 ? 'service' : 'services'}</p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {searchResults.map((service) => <ServiceCard key={service.id} service={service} />)}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#DCD5C8] bg-white p-8 text-center">
              <p className="font-bold text-[#292824]">No services found for “{searchQuery}”.</p>
              <p className="mt-2 text-sm text-[#77736B]">Try a different service name or keyword, such as sofa, carpet, fumigation, office or deep cleaning.</p>
              <Link to="/services" className="mt-4 inline-flex rounded-xl bg-[#292824] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#45423B]">Browse all services</Link>
            </div>
          )
        ) : loading ? (
          <p className="rounded-2xl border border-[#E9E5DC] bg-white p-5 text-sm text-[#77736B]">Loading categories…</p>
        ) : grouped.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {grouped.map(([category, items]) => (
              <Link
                key={category}
                to={`/categories?c=${encodeURIComponent(category)}`}
                onClick={() => trackCategoryClick(category)}
                className="group overflow-hidden rounded-2xl border border-[#E9E5DC] bg-white text-left transition duration-300 hover:-translate-y-1 hover:border-[#D5B779] hover:shadow-[0_16px_34px_rgba(41,40,36,0.09)]"
              >
                <div className="overflow-hidden">
                  <ServiceVisual
                    image={categoryImage(category)}
                    alt={category}
                    className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-40"
                  />
                </div>
                <div className="p-3.5 sm:p-4">
                  <p className="line-clamp-2 min-h-10 text-sm font-bold leading-snug text-[#292824]">{category}</p>
                  <p className="mt-1.5 text-[11px] font-medium text-[#918B80]">{items.length} {items.length === 1 ? 'service' : 'services'}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-[#E9E5DC] bg-white p-5 text-sm text-[#77736B]">
            {loadError ? 'Services could not be loaded. Please refresh and try again.' : 'No services are currently available.'}
          </p>
        )}
      </section>

      {!searchQuery && <section id="all-services" className="mx-auto max-w-7xl px-4 pt-1 md:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9A7A43] sm:text-xs">The complete catalogue</p>
            <h2 className="mt-1.5 text-xl font-extrabold tracking-tight text-[#292824] sm:text-2xl">All services</h2>
          </div>
          {!loading && services.length > 0 && (
            <span className="text-xs font-medium text-[#918B80]">{services.length} available</span>
          )}
        </div>

        {loading ? (
          <p className="rounded-2xl border border-[#E9E5DC] bg-white p-5 text-sm text-[#77736B]">Loading services…</p>
        ) : services.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {services.map((service) => <ServiceCard key={service.id} service={service} />)}
          </div>
        ) : (
          <p className="rounded-2xl border border-[#E9E5DC] bg-white p-5 text-sm text-[#77736B]">
            {loadError ? 'Services could not be loaded. Please refresh and try again.' : 'No services are currently available.'}
          </p>
        )}
      </section>}
    </main>
  );
}
