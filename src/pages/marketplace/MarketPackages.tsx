import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, CheckCircle2, Clock3, Gift, PackageOpen, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { isBookingOfferCurrent } from '@/lib/bookingEngineOffers';

type Offer = {
  id: string;
  title: string;
  description: string | null;
  offer_type: string;
  featured: boolean;
  starts_at: string | null;
  ends_at: string | null;
  display_order: number;
};

type PackageDetails = {
  services: string[];
  complimentary: string;
  condition: string;
};

function readPackageDetails(description: string | null): PackageDetails {
  const source = description || '';
  const section = (name: string, next: string) => {
    const match = source.match(new RegExp(name + ':\\s*(.*?)(?=\\.\\s*(?:' + next + '):|$)', 'i'));
    return (match?.[1] || '').trim().replace(/\\.$/, '');
  };
  const servicesText = section('Included services', 'Complimentary service|Condition|Price');
  const complimentary = section('Complimentary service', 'Condition|Price');
  const condition = section('Condition', 'Price');
  return {
    services: servicesText ? servicesText.split(';').map((item) => item.trim()).filter(Boolean) : [],
    complimentary,
    condition: condition && !/^not specified$/i.test(condition) && !/requires clarification/i.test(condition) ? condition : '',
  };
}

function quoteWhatsAppUrl(offer: Offer) {
  const message = [
    'Hello Concept Cleaning Services, I would like a quotation for this package:',
    offer.title,
    'Please confirm the final scope, eligibility and quotation before booking.',
  ].join('\\n');
  return 'https://wa.me/254796563741?text=' + encodeURIComponent(message);
}

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
        .select('id,title,description,offer_type,featured,starts_at,ends_at,display_order')
        .eq('active', true)
        .eq('offer_type', 'package')
        .order('display_order')
        .order('title');
      if (error) throw error;
      const current = ((data || []) as Offer[]).filter((offer) => isBookingOfferCurrent(offer, now));
      if (live) setOffers(current);
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
        <meta name="description" content="Explore cleaning and pest-control packages from Concept Cleaning Services and request a quotation online." />
        <link rel="canonical" href="https://www.conceptcleaningservices.co.ke/packages" />
      </Helmet>
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-8 md:px-8 md:pt-12">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9A7A43] sm:text-xs">Concept Cleaning Services</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Cleaning packages</h1>
          <p className="mt-3 text-sm leading-6 text-[#77736B] sm:text-base">Choose a package and request a quotation. Our team will confirm the service details, applicable pricing and appointment before anything is booked.</p>
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
                const details = readPackageDetails(offer.description);
                return (
                  <article key={offer.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E9E5DC] bg-white shadow-[0_8px_24px_rgba(41,40,36,0.04)]">
                    <div className="border-b border-[#EEE9DF] bg-gradient-to-br from-[#FBF8F0] to-white p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-lg font-extrabold leading-snug">{offer.title}</h2>
                        </div>
                        {offer.featured && <Badge className="shrink-0 bg-[#292824] text-white hover:bg-[#292824]">Featured</Badge>}
                      </div>
                      <p className="mt-4 text-2xl font-black tracking-tight">Quotation required</p>
                      <p className="mt-1 text-[11px] text-[#918B80]">Final price confirmed by our team</p>
                    </div>
                    <div className="flex flex-1 flex-col space-y-4 p-5">
                      {details.services.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#77736B]">Services in this package</p>
                          <ul className="space-y-2">
                            {details.services.map((service, index) => <li key={index} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6B755D]" /><span>{service}</span></li>)}
                          </ul>
                          <p className="mt-2 text-xs leading-5 text-[#77736B]">These services follow their normal pricing rules and will be itemised in your quotation.</p>
                        </div>
                      )}
                      {details.complimentary && (
                        <div className="rounded-xl border border-[#E9E5DC] bg-[#FBF8F0] p-3">
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#80652F]"><Gift className="h-4 w-4" />Complimentary service</div>
                          <p className="mt-1 text-sm font-semibold">{details.complimentary}</p>
                          <Badge className="mt-2 bg-[#292824] text-white hover:bg-[#292824]">FREE</Badge>
                        </div>
                      )}
                      {details.condition && <p className="rounded-xl bg-[#F8F6F0] p-3 text-xs leading-5 text-[#77736B]">{details.condition}</p>}
                      <div className="mt-auto border-t border-[#EEE9DF] pt-4">
                        <p className="mb-3 text-xs leading-5 text-[#77736B]">Our team will confirm the final scope and quotation with you. No booking is confirmed until you accept the quotation.</p>
                        <Button asChild className="w-full bg-[#292824] text-white hover:bg-[#45413B]">
                          <a href={quoteWhatsAppUrl(offer)} target="_blank" rel="noopener noreferrer">Request a quotation <ArrowRight className="ml-2 h-4 w-4" /></a>
                        </Button>
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
      <p className="mx-auto mt-8 flex max-w-7xl items-center gap-2 px-4 text-xs text-[#918B80] md:px-8"><Clock3 className="h-3.5 w-3.5" />A quotation request is reviewed before an appointment is confirmed.</p>
    </main>
  );
}
