import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowDownUp, ShieldCheck, Sparkles, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ServiceCard from '@/components/marketplace/ServiceCard';
import { MarketService, categoryImage, fetchMarketServices, groupByCategory, startingPrice } from '@/lib/marketplace';
import ServiceVisual from '@/components/marketplace/ServiceVisual';

type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'name';

function sortServices(list: MarketService[], key: SortKey) {
  const copy = [...list];
  if (key === 'price_asc') copy.sort((a, b) => startingPrice(a) - startingPrice(b));
  if (key === 'price_desc') copy.sort((a, b) => startingPrice(b) - startingPrice(a));
  if (key === 'name') copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy;
}

export default function MarketHome() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recommended');

  useEffect(() => {
    let mounted = true;
    fetchMarketServices()
      .then((items) => { if (mounted) setServices(items); })
      .catch(() => { if (mounted) setLoadError(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const grouped = useMemo(() => groupByCategory(services), [services]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return sortServices(services.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.short_description || s.description || '').toLowerCase().includes(q)
    ), sort);
  }, [query, services, sort]);

  return (
    <main className="min-h-screen bg-[#F6F3EC] pb-10 text-[#333333]">
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-5 md:px-6 md:pt-8">
        <div className="rounded-3xl bg-[#333333] p-5 text-[#F6F3EC] shadow-sm md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#C6A66B]">Concept Cleaning Services</p>
          <h1 className="mt-2 max-w-2xl text-2xl font-extrabold leading-tight md:text-4xl">Find the right service for your space</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#D8D1C4] md:text-base">Explore cleaning and pest-control services, compare starting prices, and choose what works for you.</p>
          <div className="relative mt-5 max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5A5752]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What service are you looking for?"
              aria-label="Search cleaning services"
              className="h-12 rounded-xl border-[#E4DFD2] bg-white pl-12 pr-11 text-sm text-[#333333] shadow-sm placeholder:text-[#5A5752] focus-visible:ring-[#C6A66B] md:h-14 md:text-base"
            />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#5A5752] hover:bg-[#F6F3EC]"><X className="h-4 w-4" /></button>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#F6F3EC]/90">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-[#C6A66B]" /> Professional service</span>
            <span className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-[#C6A66B]" /> Clear starting prices</span>
          </div>
        </div>
      </section>

      {query.trim() ? (
        <section className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8A6A2B]">Search results</p>
              <h2 className="mt-1 text-lg font-extrabold md:text-xl">Results for “{query.trim()}”</h2>
            </div>
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger className="h-9 w-[180px] rounded-full border-[#E4DFD2] bg-white text-xs"><ArrowDownUp className="mr-1 h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Default order</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {results.length ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {results.map((service) => <ServiceCard key={service.id} service={service} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E4DFD2] bg-white p-8 text-center">
              <p className="font-bold">No matching services found</p>
              <p className="mt-1 text-sm text-[#5A5752]">Try a different word or browse the categories below.</p>
              <Button variant="outline" className="mt-4 rounded-full border-[#E4DFD2]" onClick={() => setQuery('')}>Browse all services</Button>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="mx-auto max-w-6xl px-4 pb-7 md:px-6">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8A6A2B]">Start here</p>
                <h2 className="mt-1 text-xl font-extrabold md:text-2xl">Browse by category</h2>
              </div>
              <span className="pb-1 text-xs text-[#5A5752]">{grouped.length} categories</span>
            </div>
            {loading ? (
              <p className="rounded-xl bg-white p-5 text-sm text-[#5A5752]">Loading services…</p>
            ) : grouped.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {grouped.map(([category, items]) => (
                  <Link key={category} to={`/categories?c=${encodeURIComponent(category)}`} className="group overflow-hidden rounded-2xl border border-[#E4DFD2] bg-white transition hover:-translate-y-0.5 hover:border-[#C6A66B] hover:shadow-md">
                    <ServiceVisual image={categoryImage(category)} alt={category} className="h-24 w-full object-cover sm:h-28" />
                    <div className="p-3">
                      <p className="line-clamp-2 min-h-10 text-sm font-bold leading-snug">{category}</p>
                      <p className="mt-1 text-xs text-[#5A5752]">{items.length} {items.length === 1 ? 'service' : 'services'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-white p-5 text-sm text-[#5A5752]">{loadError ? 'Services could not be loaded. Please refresh and try again.' : 'No services are currently available.'}</p>
            )}
          </section>

          <section id="all-services" className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8A6A2B]">Explore the catalogue</p>
                <h2 className="mt-1 text-xl font-extrabold md:text-2xl">All services</h2>
              </div>
              <span className="pb-1 text-xs text-[#5A5752]">{services.length} available</span>
            </div>
            {loading ? (
              <p className="rounded-xl bg-white p-5 text-sm text-[#5A5752]">Loading services…</p>
            ) : services.length ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {services.map((service) => <ServiceCard key={service.id} service={service} />)}
              </div>
            ) : (
              <p className="rounded-xl bg-white p-5 text-sm text-[#5A5752]">{loadError ? 'Services could not be loaded. Please refresh and try again.' : 'No services are currently available.'}</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
