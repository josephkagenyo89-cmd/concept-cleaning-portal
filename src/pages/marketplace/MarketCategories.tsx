import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ServiceCard from '@/components/marketplace/ServiceCard';
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
    <div className="p-4 md:p-6">
      <h1 className="text-base font-bold">Categories</h1>
      <p className="mb-4 text-xs text-muted-foreground">Pulled live from our service catalogue.</p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setParams({})}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${!active ? 'border-market bg-market text-market-foreground' : ''}`}
        >
          All
        </button>
        {grouped.map(([cat]) => (
          <button
            key={cat}
            onClick={() => setParams({ c: cat })}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${active === cat ? 'border-market bg-market text-market-foreground' : ''}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {active ? (
        <section className="mt-5">
          <h2 className="mb-3 text-sm font-bold">{active}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
            {list.map((s) => <ServiceCard key={s.id} service={s} />)}
          </div>
          {!loading && list.length === 0 && (
            <p className="text-sm text-muted-foreground">No services in this category yet.</p>
          )}
        </section>
      ) : (
        <div className="mt-5 space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
          {grouped.map(([cat, items]) => (
            <button
              key={cat}
              onClick={() => setParams({ c: cat })}
              className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left"
            >
              <img
                src={categoryImage(cat)}
                alt={cat}
                loading="lazy"
                width={800}
                height={600}
                className="h-14 w-14 rounded-lg object-cover"
              />
              <span>
                <span className="block text-sm font-semibold">{cat}</span>
                <span className="block text-xs text-muted-foreground">{items.length} services available</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
