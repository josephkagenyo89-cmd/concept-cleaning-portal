// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, ShieldCheck, Star, Sparkles, ArrowDownUp, Gift, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import ServiceCard from '@/components/marketplace/ServiceCard';
import ReferralForm from '@/components/marketplace/ReferralForm';
import {
  MarketService, buildRecommendations, categoryImage, categoryVideo, fetchMarketServices, groupByCategory, startingPrice,
} from '@/lib/marketplace';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import { useSettings } from '@/hooks/useSettings';
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
  const { settings } = useSettings();
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
    <div className="bg-slate-50 pb-10">
      <style>{`
        @keyframes blink {
          0%, 49%, 100% { opacity: 1; }
          50%, 99% { opacity: 0.5; }
        }
        .blink-animation { animation: blink 1s infinite; }
      `}</style>

      <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services, categories or cleaning needs..."
            className="h-12 rounded-2xl border border-slate-200 bg-white pl-11 text-sm text-slate-700 shadow-sm placeholder:text-slate-400"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" /> Trusted service
          </div>
          <Button onClick={() => setReferralFormOpen(true)} className="h-10 bg-sky-900 px-4 text-xs font-semibold text-white hover:bg-sky-800">
            <span className="inline-flex items-center gap-2">
              <Gift size={14} /> Refer & Earn
            </span>
          </Button>
        </div>
      </div>

      {query.trim() && (
        <section className="mx-auto max-w-6xl px-4 py-6 md:px-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">Results for “{query.trim()}”</h2>
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
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <p className="text-sm text-slate-600">No services matched your search.</p>
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
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Browse</p>
                <h2 className="text-xl font-bold text-slate-900">Popular categories</h2>
              </div>
              <Button variant="link" size="sm" className="h-auto p-0 text-sm font-semibold text-sky-900" onClick={() => navigate('/categories')}>
                View all
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {grouped.map(([cat, items]) => (
                <Link key={cat} to={`/categories?c=${encodeURIComponent(cat)}`} className="group block">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
                    <ServiceVisual video={categoryVideo(cat)} image={categoryImage(cat)} alt={cat} className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                    <div className="flex items-center justify-between gap-2 px-3 py-3">
                      <span className="text-sm font-semibold text-slate-800">{cat}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{items.length}</span>
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
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">For you</p>
                  <h2 className="text-xl font-bold text-slate-900">Recommended services</h2>
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
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Catalogue</p>
                <h2 className="text-xl font-bold text-slate-900">All services</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
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
