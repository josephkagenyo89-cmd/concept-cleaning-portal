import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, ShieldCheck, Star, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ServiceCard from '@/components/marketplace/ServiceCard';
import { MarketService, categoryImage, fetchMarketServices, groupByCategory } from '@/lib/marketplace';
import { useSettings } from '@/hooks/useSettings';

export default function MarketHome() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { settings } = useSettings();

  useEffect(() => {
    fetchMarketServices()
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => groupByCategory(services), [services]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return services.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [query, services]);

  const recommended = services.slice(0, 8);

  return (
    <div>
      {/* Hero */}
      <section className="bg-market px-4 pb-6 pt-4 text-market-foreground">
        <h1 className="text-lg font-bold leading-snug">
          Book trusted cleaning &amp; fumigation services in Kenya
        </h1>
        <div className="mt-3 flex items-center gap-1 text-xs opacity-90">
          <MapPin className="h-3.5 w-3.5" /> {settings.general.address || 'Nairobi, Kenya'}
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What cleaning service are you looking for?"
            className="h-12 rounded-xl border-0 bg-card pl-9 text-sm text-foreground shadow-lg"
          />
        </div>
        <div className="mt-3 flex gap-3 text-[11px] font-medium opacity-90">
          <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Vetted staff</span>
          <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" /> Rated 4.8/5</span>
          <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" /> Same-day options</span>
        </div>
      </section>

      {/* Search results */}
      {query.trim() && (
        <section className="p-4">
          <h2 className="mb-3 text-sm font-bold">Results for “{query.trim()}”</h2>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No services matched your search.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {results.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
          )}
        </section>
      )}

      {!query.trim() && (
        <>
          {/* Categories */}
          <section className="px-4 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold">Browse categories</h2>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs text-market" onClick={() => navigate('/categories')}>
                See all
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {grouped.map(([cat]) => (
                <Link key={cat} to={`/categories?c=${encodeURIComponent(cat)}`} className="text-center">
                  <img
                    src={categoryImage(cat)}
                    alt={cat}
                    loading="lazy"
                    width={800}
                    height={600}
                    className="mx-auto h-16 w-16 rounded-full border-2 border-market/20 object-cover"
                  />
                  <span className="mt-1 block text-[11px] font-medium leading-tight">{cat}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Recommended */}
          <section className="pt-6">
            <h2 className="px-4 pb-3 text-sm font-bold">Recommended for you</h2>
            <div className="flex gap-3 overflow-x-auto px-4 pb-2">
              {loading && <p className="text-sm text-muted-foreground">Loading services…</p>}
              {recommended.map((s) => <ServiceCard key={s.id} service={s} variant="carousel" />)}
            </div>
          </section>

          {/* All services by category */}
          {grouped.map(([cat, list]) => (
            <section key={cat} className="px-4 pt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">{cat}</h2>
                <span className="text-xs text-muted-foreground">{list.length} services</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {list.slice(0, 4).map((s) => <ServiceCard key={s.id} service={s} />)}
              </div>
              {list.length > 4 && (
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => navigate(`/categories?c=${encodeURIComponent(cat)}`)}
                >
                  View all {cat}
                </Button>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
