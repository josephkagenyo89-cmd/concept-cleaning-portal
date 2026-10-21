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
    <main className="min-h-screen bg-[#F6F3EC] pb-10 text-[#333333]">
      <section className="mx-auto max-w-6xl px-4 pb-7 pt-5 md:px-6 md:pt-7">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6A2B]">Explore services</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">Browse by category</h1>
          </div>
          {!loading && grouped.length > 0 && (
            <span className="pb-1 text-xs font-medium text-[#746F66]">{grouped.length} categories</span>
          )}
        </div>

        {loading ? (
          <p className="rounded-2xl border border-[#E4DFD2] bg-white p-5 text-sm text-[#5A5752]">Loading categories…</p>
        ) : grouped.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
            {grouped.map(([category, items]) => (
              <Link
                key={category}
                to={`/categories?c=${encodeURIComponent(category)}`}
                className="group overflow-hidden rounded-2xl border border-[#E4DFD2] bg-white text-left shadow-[0_3px_14px_rgba(51,51,51,0.035)] transition duration-200 hover:-translate-y-1 hover:border-[#C6A66B] hover:shadow-[0_14px_30px_rgba(51,51,51,0.09)]"
              >
                <ServiceVisual
                  image={categoryImage(category)}
                  alt={category}
                  className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] sm:h-40"
                />
                <div className="p-3">
                  <p className="line-clamp-2 min-h-10 text-sm font-extrabold leading-snug text-[#333333]">{category}</p>
                  <p className="mt-1.5 text-xs font-medium text-[#746F66]">{items.length} {items.length === 1 ? 'service' : 'services'}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-[#E4DFD2] bg-white p-5 text-sm text-[#5A5752]">
            {loadError ? 'Services could not be loaded. Please refresh and try again.' : 'No services are currently available.'}
          </p>
        )}
      </section>

      <section id="all-services" className="mx-auto max-w-6xl px-4 pt-1 md:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A6A2B]">Explore the catalogue</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">All services</h2>
          </div>
          {!loading && services.length > 0 && (
            <span className="pb-1 text-xs font-medium text-[#746F66]">{services.length} available</span>
          )}
        </div>

        {loading ? (
          <p className="rounded-2xl border border-[#E4DFD2] bg-white p-5 text-sm text-[#5A5752]">Loading services…</p>
        ) : services.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {services.map((service) => <ServiceCard key={service.id} service={service} />)}
          </div>
        ) : (
          <p className="rounded-2xl border border-[#E4DFD2] bg-white p-5 text-sm text-[#5A5752]">
            {loadError ? 'Services could not be loaded. Please refresh and try again.' : 'No services are currently available.'}
          </p>
        )}
      </section>
    </main>
  );
}
