import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ServiceCard from '@/components/marketplace/ServiceCard';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import { MarketService, categoryImage, fetchMarketServices, groupByCategory } from '@/lib/marketplace';

export default function MarketCategories() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [params] = useSearchParams();
  const active = params.get('c');

  useEffect(() => {
    let mounted = true;
    fetchMarketServices()
      .then((items) => { if (mounted) setServices(items); })
      .catch(() => { if (mounted) setLoadError(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const grouped = useMemo(() => groupByCategory(services), [services]);
  const list = active ? services.filter((service) => service.category === active) : [];

  return (
    <main className="min-h-screen bg-[#FAF9F6] pb-12 text-[#292824]">
      <div className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-11">
        <header className="mb-7 border-b border-[#E9E5DC] pb-6 md:mb-9 md:pb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9A7A43] sm:text-xs">The service collection</p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-[#292824] sm:text-3xl md:text-4xl">{active || 'Browse categories'}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#77736B]">Explore professional cleaning and pest-control services, with clear starting prices and tailored quotation options.</p>
        </header>

        <nav aria-label="Filter by service category" className="mb-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[#E9E5DC] pb-4">
          <Link to="/categories" className={`text-xs font-bold transition-colors sm:text-sm ${!active ? 'text-[#292824]' : 'text-[#918B80] hover:text-[#292824]'}`}>
            All categories
          </Link>
          {grouped.map(([category]) => (
            <Link
              key={category}
              to={`/categories?c=${encodeURIComponent(category)}`}
              aria-current={active === category ? 'page' : undefined}
              className={`text-xs font-semibold transition-colors sm:text-sm ${active === category ? 'text-[#9A7A43] underline decoration-[#D5B779] decoration-2 underline-offset-8' : 'text-[#918B80] hover:text-[#292824]'}`}
            >
              {category}
            </Link>
          ))}
        </nav>

        {loading ? (
          <p className="rounded-2xl border border-[#E9E5DC] bg-white p-6 text-sm text-[#77736B]">Loading services…</p>
        ) : loadError ? (
          <div className="rounded-2xl border border-[#E9E5DC] bg-white p-6 text-sm text-[#77736B]">We could not load the catalogue. Please refresh and try again.</div>
        ) : active ? (
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-[#292824] md:text-xl">{active}</h2>
              <span className="text-xs text-[#918B80]">{list.length} {list.length === 1 ? 'service' : 'services'}</span>
            </div>
            {list.length ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {list.map((service) => <ServiceCard key={service.id} service={service} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#DCD5C8] bg-white p-8 text-center">
                <p className="font-bold text-[#292824]">No services in this category yet</p>
                <Link to="/categories" className="mt-3 inline-block text-sm font-semibold text-[#9A7A43] hover:text-[#292824]">Explore all categories</Link>
              </div>
            )}
          </section>
        ) : (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {grouped.map(([category, items]) => (
              <Link
                key={category}
                to={`/categories?c=${encodeURIComponent(category)}`}
                className="group overflow-hidden rounded-2xl border border-[#E9E5DC] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#D5B779] hover:shadow-[0_16px_34px_rgba(41,40,36,0.09)]"
              >
                <div className="overflow-hidden">
                  <ServiceVisual image={categoryImage(category)} alt={category} className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-48" />
                </div>
                <div className="p-3.5 sm:p-4">
                  <span className="block text-sm font-bold leading-snug text-[#292824]">{category}</span>
                  <span className="mt-1.5 block text-[11px] text-[#918B80]">{items.length} {items.length === 1 ? 'service' : 'services'}</span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
