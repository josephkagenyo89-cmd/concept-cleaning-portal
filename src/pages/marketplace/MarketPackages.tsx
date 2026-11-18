import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, CheckCircle2, Clock3, PackageOpen, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatKes } from '@/lib/marketplace';
import { supabase } from '@/integrations/supabase/client';

type ServiceLink = { offer_id: string; service_id: string; relationship: string; quantity: number; service?: { id: string; name: string; description?: string | null } };
type Offer = { id: string; title: string; description: string | null; terms: string | null; offer_type: string; price_mode: string; price_value: number | null; featured: boolean; starts_at: string | null; ends_at: string | null; display_order: number; links: ServiceLink[]; bookingServices: { id: string; name: string }[] };

const activeNow = (offer: any, now: number) =>
  (!offer.starts_at || new Date(offer.starts_at).getTime() <= now) &&
  (!offer.ends_at || new Date(offer.ends_at).getTime() >= now);

const priceLabel = (offer: Offer) => {
  const amount = Number(offer.price_value);
  if (offer.price_mode === 'fixed' && Number.isFinite(amount)) return formatKes(amount);
  if (offer.price_mode === 'fixed_discount' && Number.isFinite(amount)) return formatKes(amount) + ' off';
  if (offer.price_mode === 'percentage_discount' && Number.isFinite(amount)) return amount + '% off';
  return 'Price confirmed after review';
};

export default function MarketPackages() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setFailed(false);
      const now = Date.now();
      const { data, error } = await supabase
        .from('booking_engine_value_offers')
        .select('id,title,description,terms,offer_type,price_mode,price_value,featured,starts_at,ends_at,display_order')
        .eq('active', true)
        .eq('offer_type', 'package')
        .order('display_order')
        .order('title');
      if (error) throw error;
      const current = (data || []).filter((offer: any) => activeNow(offer, now));
      const ids = current.map((offer: any) => offer.id);
      if (!ids.length) { if (live) setOffers([]); return; }
      const [linksResult, configsResult] = await Promise.all([
        supabase.from('booking_engine_value_offer_services')
          .select('offer_id,service_id,relationship,quantity,service:services!inner(id,name,description,is_active)')
          .in('offer_id', ids),
        supabase.from('booking_engine_service_config')
          .select('service_id')
          .eq('enabled', true),
      ]);
      if (linksResult.error) throw linksResult.error;
      if (configsResult.error) throw configsResult.error;
      const enabled = new Set((configsResult.data || []).map((row: any) => row.service_id));
      const links = (linksResult.data || []) as any[];
      const ready = current.map((offer: any) => {
        const related = links.filter((link) => link.offer_id === offer.id && link.service?.is_active !== false);
        const bookingServices = related
          .filter((link) => link.relationship === 'trigger' && enabled.has(link.service_id))
          .map((link) => ({ id: link.service_id, name: link.service?.name || 'Service' }));
        return { ...offer, links: related, bookingServices };
      }).filter((offer: Offer) =>
        offer.links.some((link) => link.relationship === 'included') &&
        offer.bookingServices.length > 0
      );
      if (live) setOffers(ready);
    })().catch((error) => {
      console.error('Could not load published packages:', error);
      if (live) setFailed(true);
    }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const featured = useMemo(() => offers.filter((offer) => offer.featured), [offers]);

  return (
    <main className="min-h-screen bg-[#FAF9F6] pb-14 text-[#292824]">
      <Helmet>
        <title>Cleaning Packages | Concept Cleaning Services</title>
        <meta name="description" content="Explore published cleaning and pest-control packages from Concept Cleaning Services. Compare inclusions and request your booking online." />
        <link rel="canonical" href="https://www.conceptcleaningservices.co.ke/packages" />
      </Helmet>
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-8 md:px-8 md:pt-12">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9A7A43] sm:text-xs">Concept Cleaning Services</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Packages made simple</h1>
          <p className="mt-3 text-sm leading-6 text-[#77736B] sm:text-base">Compare what is included, see the configured package price and choose the service you want to start with. Our team reviews every request before confirming your appointment.</p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 md:px-8">
        {loading ? (
          <div className="rounded-2xl border border-[#E9E5DC] bg-white p-6 text-sm text-[#77736B]">Loading available packages…</div>
        ) : failed ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
            Packages could not be loaded right now. Please refresh or contact our team for assistance.
          </div>
        ) : offers.length ? (
          <>
            {featured.length > 0 && <div className="mb-5 flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-[#9A7A43]" />Featured packages</div>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {offers.map((offer) => {
                const included = offer.links.filter((link) => link.relationship === 'included');
                const recommended = offer.links.filter((link) => link.relationship === 'recommended');
                return (
                  <article key={offer.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E9E5DC] bg-white shadow-[0_8px_24px_rgba(41,40,36,0.04)]">
                    <div className="border-b border-[#EEE9DF] bg-gradient-to-br from-[#FBF8F0] to-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg font-extrabold leading-snug">{offer.title}</h2>
                          {offer.description && <p className="mt-2 text-sm leading-6 text-[#77736B]">{offer.description}</p>}
                        </div>
                        {offer.featured && <Badge className="shrink-0 bg-[#292824] text-white hover:bg-[#292824]">Featured</Badge>}
                      </div>
                      <p className="mt-4 text-2xl font-black tracking-tight">{priceLabel(offer)}</p>
                      <p className="mt-1 text-[11px] text-[#918B80]">{offer.price_mode === 'fixed' ? 'Configured package price' : offer.price_mode === 'fixed_discount' || offer.price_mode === 'percentage_discount' ? 'Configured saving; final total checked during booking' : 'Final price provided after review'}</p>
                    </div>
                    <div className="flex-1 space-y-4 p-5">
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#77736B]">Included in this package</p>
                        <ul className="space-y-2">
                          {included.map((link, index) => <li key={index} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /><span>{link.service?.name || 'Included service'}{Number(link.quantity) > 1 ? ' × ' + link.quantity : ''}</span></li>)}
                        </ul>
                      </div>
                      {recommended.length > 0 && <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#77736B]">Optional additions to discuss</p><ul className="space-y-1.5">{recommended.map((link, index) => <li key={index} className="text-sm text-[#77736B]">{link.service?.name || 'Optional service'}</li>)}</ul></div>}
                      {offer.terms && <p className="rounded-xl bg-[#F8F6F0] p-3 text-xs leading-5 text-[#77736B]">{offer.terms}</p>}
                      <div className="space-y-2 border-t border-[#EEE9DF] pt-4">
                        <p className="text-xs font-bold">Start your booking with</p>
                        {offer.bookingServices.map((service) => <Button key={service.id} asChild variant="outline" className="w-full justify-between border-[#DCD5C7]">
                          <Link to={`/service/${service.id}?offer=${encodeURIComponent(offer.id)}`}>{service.name}<ArrowRight className="h-4 w-4" /></Link>
                        </Button>)}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-[#E9E5DC] bg-white px-6 py-12 text-center">
            <PackageOpen className="mx-auto h-10 w-10 text-[#9A7A43]" />
            <h2 className="mt-4 text-lg font-bold">Packages are being prepared</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#77736B]">Our team is preparing the available packages. You can still explore individual services and submit a guided booking request.</p>
            <Button asChild className="mt-5 bg-[#292824] text-white hover:bg-[#45413B]"><Link to="/marketplace">Explore services<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        )}
      </section>
      <p className="mx-auto mt-8 flex max-w-7xl items-center gap-2 px-4 text-xs text-[#918B80] md:px-8"><Clock3 className="h-3.5 w-3.5" />A submitted request is reviewed before an appointment is confirmed.</p>
    </main>
  );
}
