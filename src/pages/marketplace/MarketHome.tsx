// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, ShieldCheck, ArrowDownUp, Gift, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import ServiceCard from '@/components/marketplace/ServiceCard';
import ReferralForm from '@/components/marketplace/ReferralForm';
import {
  MarketService, buildRecommendations, categoryImage, fetchMarketServices, groupByCategory, startingPrice,
} from '@/lib/marketplace';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

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
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recommended');
  const [history, setHistory] = useState<{ categories: string[]; names: string[] }>({ categories: [], names: [] });
  const [referralFormOpen, setReferralFormOpen] = useState(false);
  const navigate = useNavigate();
  const { isCustomer } = useAuth();

  useEffect(() => {
    fetchMarketServices()
      .then(setServices)
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isCustomer) { setHistory({ categories: [], names: [] }); return; }
    (async () => {
      const { data } = await supabase
        .from('bookings')
        .select('services(name, category)')
        .order('created_at', { ascending: false })
        .limit(20);
      const categories: string[] = [];
      const names: string[] = [];
      (data || []).forEach((b: any) => {
        if (b.services?.category) categories.push(b.services.category);
        if (b.services?.name) names.push(b.services.name);
      });
      setHistory({ categories: Array.from(new Set(categories)), names: Array.from(new Set(names)) });
    })();
  }, [isCustomer]);

  const grouped = useMemo(() => groupByCategory(services), [services]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const found = services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        (s.short_description || s.description || '').toLowerCase().includes(q)
    );
    return sortServices(found, sort);
  }, [query, services, sort]);

  const recommendation = useMemo(
    () => buildRecommendations(services, history.categories, history.names),
    [services, history]
  );

  return (
    <div className="bg-brand-paper pb-10 dark:bg-background">
      <Helmet>
        <title>Cleaning &amp; pest control services in Nairobi | Concept</title>
        <meta name="description" content="Browse cleaning, fumigation, carpet and upholstery services in Nairobi. Compare clear prices and book a vetted local team." />
      </Helmet>

      <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-brassDark">Concept · Nairobi</p>
          <h1 className="mt-1 text-xl font-bold text-brand-forest md:text-2xl">What do you need help with?</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-slate/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services, categories or cleaning needs..."
            className="h-12 rounded-xl border border-brand-sand bg-white pl-11 text-sm text-brand-ink shadow-none placeholder:text-brand-slate/60 dark:bg-card dark:text-foreground"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full border border-brand-sand bg-white px-3 py-1.5 text-xs font-medium text-brand-forest dark:bg-card">
            <ShieldCheck className="h-3.5 w-3.5" /> Trusted service
          </div>
          <Button onClick={() => setReferralFormOpen(true)} className="h-10 bg-brand-forest px-4 text-xs font-semibold text-white hover:bg-brand-panel">
            <span className="inline-flex items-center gap-2">
              <Gift size={14} /> Refer & Earn
            </span>
          </Button>
        </div>
      </div>

      {query.trim() && (
        <section className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-brand-ink">Results for “{query.trim()}”</h2>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-9 w-[170px] text-xs">
                <ArrowDownUp className="mr-1 h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">Best match</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {results.length === 0 ? (
            <div className="rounded-xl border border-brand-sand bg-white p-8 text-center dark:bg-card">
              <p className="text-sm text-brand-slate">No services matched your search.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setQuery('')}>Clear search</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {results.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
          )}
        </section>
      )}

      {!query.trim() && (
        <>
          <section className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-brassDark">Browse</p>
                <h2 className="text-xl font-bold text-brand-ink">Popular categories</h2>
              </div>
              <Button variant="link" size="sm" className="h-auto p-0 text-sm font-semibold text-brand-forest" onClick={() => navigate('/categories')}>
                View all
              </Button>
            </div>

            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0" role="region" aria-label="Browse service categories" tabIndex={0}>
              {grouped.map(([cat, items]) => (
                <Link key={cat} to={`/categories?c=${encodeURIComponent(cat)}`} className="group block w-52 shrink-0 snap-start sm:w-60">
                  <div className="overflow-hidden rounded-xl border border-brand-sand bg-white transition-colors hover:border-brand-brass/70 dark:bg-card">
                    <ServiceVisual image={categoryImage(cat)} alt={cat} className="h-32 w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 px-3 py-3">
                      <span className="text-sm font-semibold text-brand-ink">{cat}</span>
                      <span className="rounded-full bg-brand-paper px-2 py-0.5 text-[10px] font-semibold text-brand-slate dark:bg-muted dark:text-muted-foreground">{items.length}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {recommendation.length > 0 && (
            <section className="mx-auto max-w-6xl px-4 py-2 md:px-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-brassDark">For you</p>
                  <h2 className="text-xl font-bold text-brand-ink">Recommended services</h2>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {recommendation.map((s) => <ServiceCard key={s.id} service={s} />)}
              </div>
            </section>
          )}

          <section id="all-services" className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-brassDark">Catalogue</p>
                <h2 className="text-xl font-bold text-brand-ink">All services</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-sand bg-white px-3 py-1.5 text-xs font-medium text-brand-forest dark:bg-card">
                <CheckCircle2 className="h-3.5 w-3.5" /> {services.length} available
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {services.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
          </section>
        </>
      )}

      <ReferralForm isOpen={referralFormOpen} onClose={() => setReferralFormOpen(false)} />
    </div>
  );
}
