import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ServiceCard from '@/components/marketplace/ServiceCard';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import { MarketService, categoryImage, fetchMarketServices, groupByCategory } from '@/lib/marketplace';

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
    <div className="bg-brand-paper pb-10 dark:bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <header className="mb-6 border-b border-brand-sand pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-brassDark">Services & prices · Nairobi</p>
          <h1 className="mt-2 text-2xl font-bold text-brand-forest md:text-3xl">Find the right service for your space</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-slate">Browse by category to compare services and book the solution that fits your home or business.</p>
        </header>

        <div className="-mx-4 mb-5 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0 dark:text-foreground" role="region" aria-label="Filter services by category" tabIndex={0}>
          <div className="flex w-max gap-2">
            <button onClick={() => setParams({})} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${!active ? 'border-brand-forest bg-brand-forest text-brand-cream' : 'border-brand-sand bg-white text-brand-ink hover:border-brand-brass/70 dark:bg-card dark:text-foreground'}`}>
              All services
            </button>
            {grouped.map(([cat]) => (
              <button key={cat} onClick={() => setParams({ c: cat })} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${active === cat ? 'border-brand-forest bg-brand-forest text-brand-cream' : 'border-brand-sand bg-white text-brand-ink hover:border-brand-brass/70 dark:bg-card dark:text-foreground'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="mt-6 text-sm text-brand-slate">Loading…</p>}

        {active ? (
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-brand-ink">{active}</h2>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-slate shadow-sm">{list.length} services</span>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {list.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
            {!loading && list.length === 0 && (
              <p className="mt-6 text-sm text-brand-slate">No services in this category yet.</p>
            )}
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {grouped.map(([cat, items]) => (
              <button
                key={cat}
                onClick={() => setParams({ c: cat })}
                className="group overflow-hidden rounded-xl border border-brand-sand bg-white text-left transition-colors hover:border-brand-brass/70 dark:bg-card"
              >
                <ServiceVisual
                  image={categoryImage(cat)}
                  alt={cat}
                  className="h-40 w-full object-cover"
                />
                <div className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <span className="block text-base font-semibold text-brand-ink">{cat}</span>
                    <span className="mt-1 block text-xs text-brand-slate">{items.length} services available</span>
                  </div>
                  <span className="rounded-full bg-brand-paper px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-brassDark">Explore</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
