import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, ShieldCheck, Star, Sparkles, ArrowDownUp, Gift } from 'lucide-react';
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
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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

  // Booking history powers the cross-sell recommendations.
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
    <div>
      <style>{`
        @keyframes blink {
          0%, 49%, 100% { opacity: 1; }
          50%, 99% { opacity: 0.5; }
        }
        .blink-animation {
          animation: blink 1s infinite;
        }
      `}</style>

      {/* Hero */}
      <section className="bg-market px-4 pb-6 pt-4 text-market-foreground">
        <h1 className="text-lg font-bold leading-snug">
          Book trusted cleaning &amp; fumigation services in Nairobi, Kenya
        </h1>
        <div className="mt-3 flex items-center gap-1 text-xs opacity-90">
          <MapPin className="h-3.5 w-3.5" /> {settings.general.address || 'Nairobi, Kenya'}
        </div>

        {/* Refer & Earn Button - Mobile (above search) - Smaller with Blink */}
        <div className="mt-3 md:hidden">
          <Button
            onClick={() => setReferralFormOpen(true)}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 text-sm blink-animation"
          >
            <Gift size={16} />
            💰 Refer & Earn
          </Button>
        </div>

        {/* Search Field */}
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

      {/* Refer & Earn Button - Desktop (in header area) */}
      <section className="hidden md:block px-4 pt-4">
        <Button
          onClick={() => setReferralFormOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-2 rounded-lg flex items-center gap-2"
        >
          <Gift size={18} />
          💰 Refer & Earn
        </Button>
      </section>

      {/* Search results */}
      {query.trim() && (
        <section className="p-4 md:p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">Results for "{query.trim()}"</h2>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-[150px] text-xs">
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
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">No services matched your search.</p>
              <Button variant="outline" size="sm" onClick={() => setQuery('')}>Clear search</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
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
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 md:gap-4">
              {grouped.map(([cat]) => (
                <Link key={cat} to={`/categories/${cat}`}>
                  <div className="group relative overflow-hidden rounded-xl">
                    <img src={categoryImage(cat)} alt={cat} className="aspect-square object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/40 transition-opacity group-hover:bg-black/50" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-center text-xs font-bold text-white">{cat}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Recommendations */}
          {recommendation.length > 0 && (
            <section className="mt-6 px-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">Recommended for you</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
                {recommendation.map((s) => <ServiceCard key={s.id} service={s} />)}
              </div>
            </section>
          )}

          {/* All services */}
          <section className="mt-6 px-4 pb-6">
            <h2 className="mb-3 text-sm font-bold">All services</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
              {services.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
          </section>
        </>
      )}

      {/* Referral Form Modal */}
      <ReferralForm isOpen={referralFormOpen} onClose={() => setReferralFormOpen(false)} />
    </div>
  );
}
