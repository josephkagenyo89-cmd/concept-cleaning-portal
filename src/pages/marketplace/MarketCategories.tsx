import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import ServiceCard from '@/components/marketplace/ServiceCard';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import { MarketService, categoryImage, fetchMarketServices, groupByCategory } from '@/lib/marketplace';

export default function MarketCategories() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [params, setParams] = useSearchParams();
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
    <main className="min-h-screen bg-[#F6F3EC] pb-10 text-[#333333]">
      <div className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
        <Link to="/marketplace" className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#5A5752] hover:text-[#333333]">
          <ArrowLeft className="h-4 w-4" /> Back to services
        </Link>

        <header className="mb-6 rounded-3xl bg-[#333333] px-5 py-6 text-[#F6F3EC] md:px-8 md:py-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C6A66B]">Explore our services</p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight md:text-3xl">{active || 'Browse by category'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#D8D1C4]">Choose a category to see available services, starting prices and quotation options.</p>
        </header>

        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:px-0">
          <button type="button" onClick={() => setParams({})} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${!active ? 'border-[#333333] bg-[#333333] text-white' : 'border-[#E4DFD2] bg-white text-[#5A5752] hover:border-[#C6A66B]'}`}>All categories</button>
          {grouped.map(([category]) => (
            <button key={category} type="button" onClick={() => setParams({ c: category })} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition ${active === category ? 'border-[#333333] bg-[#333333] text-white' : 'border-[#E4DFD2] bg-white text-[#5A5752] hover:border-[#C6A66B]'}`}>
              {category}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="rounded-2xl bg-white p-6 text-sm text-[#5A5752]">Loading services…</p>
        ) : loadError ? (
          <div className="rounded-2xl border border-[#E4DFD2] bg-white p-6 text-sm text-[#5A5752]">We could not load the catalogue. Please refresh and try again.</div>
        ) : active ? (
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold md:text-xl">{active}</h2>
              <span className="text-xs text-[#5A5752]">{list.length} {list.length === 1 ? 'service' : 'services'}</span>
            </div>
            {list.length ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {list.map((service) => <ServiceCard key={service.id} service={service} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#E4DFD2] bg-white p-8 text-center">
                <p className="font-bold">No services in this category yet</p>
                <Link to="/marketplace" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-[#8A6A2B]">Browse all services <ChevronRight className="h-4 w-4" /></Link>
              </div>
            )}
          </section>
        ) : (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {grouped.map(([category, items]) => (
              <button key={category} type="button" onClick={() => setParams({ c: category })} className="group overflow-hidden rounded-2xl border border-[#E4DFD2] bg-white text-left transition hover:-translate-y-0.5 hover:border-[#C6A66B] hover:shadow-md">
                <ServiceVisual image={categoryImage(category)} alt={category} className="h-28 w-full object-cover sm:h-36" />
                <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
                  <div className="min-w-0">
                    <span className="block text-sm font-extrabold leading-snug">{category}</span>
                    <span className="mt-1 block text-xs text-[#5A5752]">{items.length} {items.length === 1 ? 'service' : 'services'}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#8A6A2B]" />
                </div>
              </button>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
