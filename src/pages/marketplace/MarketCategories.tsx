import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ServiceCard from '@/components/marketplace/ServiceCard';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import { MarketService, categoryImage, categoryVideo, fetchMarketServices, groupByCategory } from '@/lib/marketplace';

export default function MarketCategories() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [loading, setLoading] = useState(true);
  const [params, setParams] = useSearchParams();
  const active = params.get('c');

  useEffect(() => {
    fetchMarketServices()
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => groupByCategory(services), [services]);
  const list = active ? services.filter((s) => s.category === active) : [];

  return (
    <div className="bg-slate-50 pb-10">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <div className="mb-6 rounded-3xl bg-gradient-to-r from-sky-950 via-sky-900 to-emerald-800 px-5 py-6 text-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] md:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">Service categories</p>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">Find the right service for your space</h1>
          <p className="mt-2 max-w-2xl text-sm text-sky-100">Browse by category to compare services and book the solution that fits your home or business.</p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setParams({})}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${!active ? 'border-sky-900 bg-sky-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
          >
            All
          </button>
          {grouped.map(([cat]) => (
            <button
              key={cat}
              onClick={() => setParams({ c: cat })}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${active === cat ? 'border-sky-900 bg-sky-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading && <p className="mt-6 text-sm text-slate-600">Loading…</p>}

        {active ? (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{active}</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">{list.length} services</span>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {list.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
            {!loading && list.length === 0 && (
              <p className="mt-6 text-sm text-slate-600">No services in this category yet.</p>
            )}
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {grouped.map(([cat, items]) => (
              <button
                key={cat}
                onClick={() => setParams({ c: cat })}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
              >
                <ServiceVisual
                  video={categoryVideo(cat)}
                  image={categoryImage(cat)}
                  alt={cat}
                  className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <div className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <span className="block text-base font-semibold text-slate-900">{cat}</span>
                    <span className="mt-1 block text-xs text-slate-500">{items.length} services available</span>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Explore</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
