import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, CheckCircle2, Gift, PackageOpen, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { isBookingOfferCurrent } from '@/lib/bookingEngineOffers';

type PackageItem = { id: string; service_id: string; item_label: string | null; size_label: string; quantity: number; individual_price: number | null; complimentary: boolean; display_order: number; service?: { name?: string } | null };
type Offer = { id: string; title: string; description: string | null; offer_type: string; featured: boolean; starts_at: string | null; ends_at: string | null; display_order: number; price_mode: string; price_value: number | null; items: PackageItem[] };

export default function MarketPackages() {
 const [offers, setOffers] = useState<Offer[]>([]);
 const [loading, setLoading] = useState(true);
 const [failed, setFailed] = useState(false);

 useEffect(() => {
  let live = true;
  (async () => {
   setLoading(true); setFailed(false);
   const now = Date.now();
   const { data, error } = await supabase.from('booking_engine_value_offers')
    .select('id,title,description,offer_type,featured,starts_at,ends_at,display_order,price_mode,price_value')
    .eq('active', true).eq('offer_type', 'package').eq('price_mode', 'fixed')
    .not('price_value', 'is', null).order('display_order').order('title');
   if (error) throw error;
   const current = ((data || []) as Omit<Offer,'items'>[]).filter(o => isBookingOfferCurrent(o, now));
   const ids = current.map(o => o.id);
   const itemResult = ids.length ? await supabase.from('booking_engine_package_items')
    .select('id,offer_id,service_id,item_label,size_label,quantity,individual_price,complimentary,display_order,service:services(name)')
    .in('offer_id', ids).eq('active', true).order('display_order') : { data: [], error: null };
   if (itemResult.error) throw itemResult.error;
   const byOffer: Record<string, PackageItem[]> = {};
   for (const row of (itemResult.data || []) as any[]) (byOffer[row.offer_id] ||= []).push(row);
   const complete = current.filter(o => (byOffer[o.id] || []).length > 0 && (byOffer[o.id] || []).every(i => !!i.size_label));
   if (live) setOffers(complete.map(o => ({ ...o, items: byOffer[o.id] || [] })));
  })().catch(error => { console.error('Could not load published packages:', error); if (live) setFailed(true); })
   .finally(() => { if (live) setLoading(false); });
  return () => { live = false; };
 }, []);

 const featured = useMemo(() => offers.filter(o => o.featured), [offers]);
 const money = (value: number) => 'KSh ' + Number(value).toLocaleString('en-KE', { maximumFractionDigits: 2 });

 return <main className="min-h-screen bg-[#FAF9F6] pb-14 text-[#292824]">
  <Helmet><title>Cleaning Packages | Concept Cleaning Services</title><meta name="description" content="Explore clearly priced cleaning and pest-control packages from Concept Cleaning Services, with included services, sizes and quantities."/><link rel="canonical" href="https://www.conceptcleaningservices.co.ke/packages"/></Helmet>
  <section className="mx-auto max-w-7xl px-4 pb-8 pt-8 md:px-8 md:pt-12"><div className="max-w-3xl">
   <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9A7A43] sm:text-xs">Concept Cleaning Services</p>
   <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Cleaning packages</h1>
   <p className="mt-3 text-sm leading-6 text-[#77736B] sm:text-base">See exactly what each package includes, the selected sizes and quantities, and the final package price before you book.</p>
  </div></section>
  <section className="mx-auto max-w-7xl px-4 md:px-8">
   {loading ? <div className="rounded-2xl border border-[#E9E5DC] bg-white p-6 text-sm text-[#77736B]">Loading available packages…</div>
   : failed ? <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">Packages could not be loaded right now. Please refresh or contact our team for assistance.</div>
   : offers.length ? <>
    {featured.length > 0 && <div className="mb-5 flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-[#9A7A43]"/>Featured packages</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{offers.map(offer => {
     const firstService = offer.items.find(i => !i.complimentary) || offer.items[0];
     const customerDescription = offer.description && !/Included services:|Price: To be quoted/i.test(offer.description) ? offer.description : null;
     return <article key={offer.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E9E5DC] bg-white shadow-[0_8px_24px_rgba(41,40,36,0.04)]">
      <div className="border-b border-[#EEE9DF] bg-gradient-to-br from-[#FBF8F0] to-white p-5"><div className="flex items-start justify-between gap-3"><h2 className="text-lg font-extrabold leading-snug">{offer.title}</h2>{offer.featured&&<Badge className="shrink-0 bg-[#292824] text-white hover:bg-[#292824]">Featured</Badge>}</div>
       <p className="mt-4 text-2xl font-black tracking-tight">{money(offer.price_value || 0)}</p><p className="mt-1 text-[11px] text-[#918B80]">Final package price · no quotation required</p>
      </div>
      <div className="flex flex-1 flex-col space-y-4 p-5">
       {customerDescription&&<p className="text-sm leading-6 text-[#77736B]">{customerDescription}</p>}
       <div><p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#77736B]">What's included</p><ul className="space-y-3">{offer.items.map(item => <li key={item.id} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6B755D]"/><span className="min-w-0"><span className="font-semibold">{item.item_label || item.service?.name || 'Cleaning service'}</span><span className="block text-xs text-[#77736B]">{item.size_label} · Qty {Number(item.quantity)}</span>{item.complimentary&&<Badge className="mt-1 bg-[#292824] text-white hover:bg-[#292824]">Complimentary</Badge>}</span></li>)}</ul></div>
       <div className="mt-auto border-t border-[#EEE9DF] pt-4"><p className="mb-3 text-xs leading-5 text-[#77736B]">The package price covers the services and quantities listed above. Additional work can be discussed separately.</p>
        <Button asChild className="w-full bg-[#292824] text-white hover:bg-[#45413B]"><Link to={firstService?'/service/'+firstService.service_id+'?offer='+offer.id:'/marketplace'}>Book this package <ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
       </div>
      </div>
     </article>;
    })}</div>
   </> : <div className="rounded-2xl border border-[#E9E5DC] bg-white px-6 py-12 text-center"><PackageOpen className="mx-auto h-10 w-10 text-[#9A7A43]"/><h2 className="mt-4 text-lg font-bold">Packages are being prepared</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#77736B]">Our team is preparing the package contents and prices. You can still explore individual services and book them online.</p><Button asChild className="mt-5 bg-[#292824] text-white hover:bg-[#45413B]"><Link to="/marketplace">Explore services<ArrowRight className="ml-2 h-4 w-4"/></Link></Button></div>}
  </section>
 </main>;
}
