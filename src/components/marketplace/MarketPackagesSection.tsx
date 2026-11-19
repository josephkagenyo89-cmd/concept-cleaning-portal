import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gift,
  Package,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { isBookingOfferCurrent } from '@/lib/bookingEngineOffers';

type PackageService = {
  offer_id: string;
  service_id: string;
  relationship: 'trigger' | 'included' | 'recommended';
  quantity: number;
  services?: { name?: string | null; description?: string | null } | null;
};

type BookingPackage = {
  id: string;
  offer_key: string;
  title: string;
  description: string | null;
  terms: string | null;
  price_mode: 'quotation' | 'fixed' | string;
  price_value: number | null;
  currency: string;
  featured: boolean;
  starts_at: string | null;
  ends_at: string | null;
  display_order: number;
  services: PackageService[];
};

type Props = { variant?: 'home' | 'full' };

const db = supabase as any;

function packagePrice(offer: BookingPackage) {
  if (offer.price_mode !== 'fixed' || offer.price_value === null) return 'Quotation required';
  if (offer.currency === 'KES') return 'KSh ' + Number(offer.price_value).toLocaleString('en-KE', { maximumFractionDigits: 2 });
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: offer.currency || 'KES',
    maximumFractionDigits: 2,
  }).format(Number(offer.price_value));
}

function packageWhatsAppUrl(offer: BookingPackage) {
  const price = packagePrice(offer);
  const message = [
    'Hello Concept Cleaning Services, I would like to enquire about this package:',
    offer.title,
    price === 'Quotation required' ? 'Please prepare a quotation and confirm the final scope.' : 'Please confirm the package scope and booking arrangements.',
    'Package reference: ' + offer.id,
  ].join('\n');
  return 'https://wa.me/254796563741?text=' + encodeURIComponent(message);
}

function packageServices(offer: BookingPackage, relationship: PackageService['relationship']) {
  return offer.services.filter((item) => item.relationship === relationship);
}

function PackageCard({ offer, onView }: { offer: BookingPackage; onView: (offer: BookingPackage) => void }) {
  const included = packageServices(offer, 'included');
  const triggers = packageServices(offer, 'trigger');

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E9E5DC] bg-white shadow-[0_8px_24px_rgba(41,40,36,0.04)] transition duration-300 hover:-translate-y-1 hover:border-[#D5B779] hover:shadow-[0_16px_34px_rgba(41,40,36,0.09)]">
      <div className="relative overflow-hidden border-b border-[#EEE9DF] bg-gradient-to-br from-[#292824] via-[#45413B] to-[#80652F] p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10">
            <Package className="h-5 w-5" />
          </div>
          {offer.featured && <Badge className="border-0 bg-[#D5B779] text-[#292824] hover:bg-[#D5B779]">Featured</Badge>}
        </div>
        <h3 className="mt-5 line-clamp-2 text-xl font-extrabold leading-tight">{offer.title}</h3>
        <p className="mt-3 text-2xl font-black tracking-tight">{packagePrice(offer)}</p>
        <p className="mt-1 text-[11px] text-white/75">
          {offer.price_mode === 'fixed' ? 'Approved package price' : 'Final price confirmed by our team'}
        </p>
      </div>
      <div className="flex flex-1 flex-col p-5">
        {offer.description && <p className="line-clamp-3 text-sm leading-6 text-[#77736B]">{offer.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#77736B]">
          {triggers.length > 0 && <span className="rounded-full bg-[#F5F2EB] px-3 py-1.5">{triggers.length} starting {triggers.length === 1 ? 'service' : 'services'}</span>}
          {included.length > 0 && <span className="rounded-full bg-[#F5F2EB] px-3 py-1.5">{included.length} included {included.length === 1 ? 'service' : 'services'}</span>}
          {offer.ends_at && <span className="rounded-full bg-[#F5F2EB] px-3 py-1.5">Until {new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(offer.ends_at))}</span>}
        </div>
        <div className="mt-auto flex gap-2 pt-5">
          <Button className="w-full bg-[#292824] text-white hover:bg-[#45413B]" onClick={() => onView(offer)}>
            View package <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function MarketPackagesSection({ variant = 'home' }: Props) {
  const [offers, setOffers] = useState<BookingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'featured'>('all');
  const [selectedOffer, setSelectedOffer] = useState<BookingPackage | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const isHome = variant === 'home';

  const loadPackages = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setFailed(false);
    try {
      const { data, error } = await db
        .from('booking_engine_value_offers')
        .select('id,offer_key,title,description,terms,price_mode,price_value,currency,featured,starts_at,ends_at,display_order')
        .eq('active', true)
        .eq('offer_type', 'package')
        .order('display_order')
        .order('title');
      if (error) throw error;

      const current = ((data || []) as Omit<BookingPackage, 'services'>[])
        .filter((offer) => isBookingOfferCurrent(offer))
        .map((offer) => ({ ...offer, services: [] as PackageService[] }));

      if (current.length) {
        const { data: links, error: linksError } = await db
          .from('booking_engine_value_offer_services')
          .select('offer_id,service_id,relationship,quantity,services(name,description)')
          .in('offer_id', current.map((offer) => offer.id));
        if (linksError) throw linksError;
        for (const link of (links || []) as PackageService[]) {
          const target = current.find((offer) => offer.id === link.offer_id);
          if (target) target.services.push(link);
        }
      }
      setOffers(current);
    } catch (error) {
      console.error('Could not load published packages:', error);
      setFailed(true);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPackages(true);
    const refreshOnFocus = () => { void loadPackages(); };
    window.addEventListener('focus', refreshOnFocus);

    // Keep the showcase in sync with admin publication, edits and package contents.
    // Focus refresh remains as a fallback if realtime is not enabled for these tables.
    const channel = supabase
      .channel('market-packages-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_engine_value_offers' }, refreshOnFocus)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_engine_value_offer_services' }, refreshOnFocus)
      .subscribe();

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [loadPackages]);

  const featuredCount = useMemo(() => offers.filter((offer) => offer.featured).length, [offers]);
  const visibleOffers = useMemo(
    () => (filter === 'featured' ? offers.filter((offer) => offer.featured) : offers),
    [filter, offers],
  );
  const cardOffers = isHome ? visibleOffers.slice(0, 4) : visibleOffers;

  const scrollCarousel = (direction: 'left' | 'right') => {
    carouselRef.current?.scrollBy({ left: direction === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  const content = (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9A7A43] sm:text-xs">Curated cleaning solutions</p>
          <h2 className={isHome ? 'mt-1.5 text-xl font-extrabold tracking-tight text-[#292824] sm:text-2xl' : 'mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl'}>
            {isHome ? 'Explore our packages' : 'Cleaning packages'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#77736B]">
            {isHome ? 'Thoughtfully combined services, with clear inclusions and transparent package pricing.' : 'Compare package inclusions, review the terms and send your package enquiry directly to our team.'}
          </p>
        </div>
        {isHome && offers.length > 0 && (
          <Link to="/packages" className="inline-flex items-center text-sm font-bold text-[#80652F] hover:text-[#292824]">
            View all packages <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        )}
      </div>

      {featuredCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All packages</Button>
          <Button size="sm" variant={filter === 'featured' ? 'default' : 'outline'} onClick={() => setFilter('featured')}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Featured
          </Button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#E9E5DC] bg-white p-6 text-sm text-[#77736B]">Loading available packages…</div>
      ) : failed ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          Packages could not be loaded right now. Please refresh or contact our team for assistance.
        </div>
      ) : cardOffers.length > 0 ? (
        <>
          {featuredCount > 0 && <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#80652F]"><Sparkles className="h-4 w-4" />Featured and available packages</div>}
          {isHome ? (
            <div className="relative">
              <div ref={carouselRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pr-1">
                {cardOffers.map((offer) => (
                  <div key={offer.id} className="w-[min(86vw,320px)] min-w-[min(86vw,320px)] snap-start sm:w-[320px] sm:min-w-[320px]">
                    <PackageCard offer={offer} onView={setSelectedOffer} />
                  </div>
                ))}
              </div>
              {cardOffers.length > 1 && (
                <div className="mt-2 hidden justify-end gap-2 sm:flex">
                  <Button size="icon" variant="outline" aria-label="Scroll packages left" onClick={() => scrollCarousel('left')}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="icon" variant="outline" aria-label="Scroll packages right" onClick={() => scrollCarousel('right')}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cardOffers.map((offer) => <PackageCard key={offer.id} offer={offer} onView={setSelectedOffer} />)}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-[#E9E5DC] bg-white px-6 py-12 text-center">
          <Package className="mx-auto h-10 w-10 text-[#9A7A43]" />
          <h3 className="mt-4 text-lg font-bold">Packages are being prepared</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#77736B]">
            Our team is preparing the available packages. You can still explore individual services and submit a guided booking request.
          </p>
          {!isHome && <Button asChild className="mt-5 bg-[#292824] text-white hover:bg-[#45413B]"><Link to="/marketplace">Explore services<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
        </div>
      )}
      {!loading && !failed && offers.length > 0 && isHome && (
        <div className="mt-3 text-right">
          <Link to="/packages" className="text-xs font-semibold text-[#80652F] hover:text-[#292824]">Browse the complete package collection</Link>
        </div>
      )}
      <Dialog open={Boolean(selectedOffer)} onOpenChange={(open) => { if (!open) setSelectedOffer(null); }}>
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
          {selectedOffer && (
            <>
              <DialogHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Package className="h-5 w-5 text-[#9A7A43]" />
                  {selectedOffer.featured && <Badge className="bg-[#292824] text-white hover:bg-[#292824]">Featured</Badge>}
                </div>
                <DialogTitle className="text-xl">{selectedOffer.title}</DialogTitle>
                <DialogDescription>{selectedOffer.description || 'A curated Concept Cleaning Services package.'}</DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="rounded-xl bg-[#F7F4ED] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#77736B]">Package price</p>
                  <p className="mt-1 text-2xl font-black text-[#292824]">{packagePrice(selectedOffer)}</p>
                  <p className="mt-1 text-xs text-[#77736B]">
                    {selectedOffer.price_mode === 'fixed' ? 'This is the configured package price. Final scope and appointment details are confirmed by the team.' : 'Our team will review your requirements and confirm the quotation before booking.'}
                  </p>
                </div>
                {(['trigger', 'included', 'recommended'] as const).map((relationship) => {
                  const items = packageServices(selectedOffer, relationship);
                  if (!items.length) return null;
                  const heading = relationship === 'trigger' ? 'Start with one of these services' : relationship === 'included' ? 'Included in this package' : 'Optional additions';
                  return (
                    <div key={relationship}>
                      <h4 className="mb-2 text-sm font-bold">{heading}</h4>
                      <ul className="space-y-2">
                        {items.map((item) => (
                          <li key={item.service_id + relationship} className="flex items-start gap-2 text-sm text-[#555149]">
                            {relationship === 'included' ? <Gift className="mt-0.5 h-4 w-4 shrink-0 text-[#9A7A43]" /> : relationship === 'recommended' ? <Plus className="mt-0.5 h-4 w-4 shrink-0 text-[#9A7A43]" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#6B755D]" />}
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">{item.services?.name || 'Service'}</span>
                              {Number(item.quantity) !== 1 && <span className="ml-1 text-xs text-[#77736B]">× {Number(item.quantity)}</span>}
                              {relationship === 'included' && <span className="block text-xs text-[#77736B]">Included at no separate charge</span>}
                              {relationship === 'recommended' && <span className="block text-xs text-[#77736B]">Optional; price confirmed separately</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {selectedOffer.terms && (
                  <div className="rounded-xl border border-[#E9E5DC] p-3">
                    <h4 className="text-sm font-bold">Terms and eligibility</h4>
                    <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#77736B]">{selectedOffer.terms}</p>
                  </div>
                )}
                {selectedOffer.ends_at && (
                  <p className="flex items-center gap-2 text-xs text-[#77736B]"><CalendarClock className="h-4 w-4" />Available until {new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(selectedOffer.ends_at))}</p>
                )}
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button asChild className="w-full bg-[#292824] text-white hover:bg-[#45413B]">
                  <a href={packageWhatsAppUrl(selectedOffer)} target="_blank" rel="noopener noreferrer">
                    {selectedOffer.price_mode === 'fixed' ? 'Enquire / request booking' : 'Request a quotation'} <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button variant="outline" onClick={() => setSelectedOffer(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );

  if (isHome) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {content}
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF9F6] pb-14 pt-8 text-[#292824] md:pt-12">
      <section className="mx-auto max-w-7xl px-4 md:px-8">
        {content}
        <p className="mt-8 flex items-center gap-2 text-xs text-[#918B80]"><CalendarClock className="h-3.5 w-3.5" />Package schedules and prices are controlled by our team and shown here when published.</p>
      </section>
    </main>
  );
}
