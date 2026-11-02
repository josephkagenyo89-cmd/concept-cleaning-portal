import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ServiceCard from '@/components/marketplace/ServiceCard';
import { MarketService, categoryImage, fetchMarketServices, groupByCategory } from '@/lib/marketplace';
import ServiceVisual from '@/components/marketplace/ServiceVisual';

export default function MarketHome() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchMarketServices()
      .then((items) => { if (mounted) setServices(items); })
      .catch(() => { if (mounted) setLoadError(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const grouped = useMemo(() => groupByCategory(services), [services]);

  return (
    <main className="min-h-screen bg-[#FAF9F6] pb-12 text-[#292824]">
      <section className="mx-auto max-w-7xl px-4 pb-9 pt-7 md:px-8 md:pb-12 md:pt-11">
        <div className="mb-6 flex items-end justify-between gap-3 md:mb-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9A7A43] sm:text-xs">Concept Cleaning Services</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#292824] sm:text-3xl md:text-4xl">Explore our services</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#77736B]">Thoughtful care for your home, workplace and surroundings.</p>
          </div>
          {!loading && grouped.length > 0 && (
            <span className="hidden rounded-full border border-[#E7E1D5] bg-white px-4 py-2 text-xs font-semibold text-[#77736B] sm:inline-flex">{grouped.length} categories</span>
          )}
        </div>

        {loading ? (
          <p className="rounded-2xl border border-[#E9E5DC] bg-white p-5 text-sm text-[#77736B]">Loading categories…</p>
        ) : grouped.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {grouped.map(([category, items]) => (
              <Link
                key={category}
                to={`/categories?c=${encodeURIComponent(category)}`}
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

      <section id="all-services" className="mx-auto max-w-7xl px-4 pt-1 md:px-8">
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
      </section>
    </main>
  );
}
