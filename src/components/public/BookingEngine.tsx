/**
 * BookingEngine — Uber-style hero widget for the landing page.
 * Type what you need -> live matches from the `services` table -> pick one ->
 * add where/when -> price reveals -> Book now / Get quotation.
 *
 * Authenticated customers continue through the existing service-detail workflow;
 * guests submit through the existing secure guest-request endpoint. The service
 * catalogue and pricing remain sourced from the existing services data utilities.
 * Categories are being migrated to the approved service_categories/category_id
 * relationship separately; this component must not invent category mappings.
 *
 * Note: for per-sq-m services this widget estimates price from the size entered;
 * the detail page still prices at startingPrice(), so confirm the total there.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, ArrowRight, Loader2, MapPin, MessageCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { waLink } from '@/components/public/PublicShell';
import {
  MarketService,
  fetchBookingEngineCategories,
  fetchBookingEngineServices,
  formatKes,
  groupByCategory,
  startingPrice,
  serviceImage
} from '@/lib/marketplace';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import { useGlobalDiscount } from '@/hooks/useGlobalDiscount';
import { applyGlobalDiscount } from '@/lib/globalDiscount';
import { rememberGuestWhatsAppRequest } from '@/lib/guestWhatsAppReturn';

/* The catalogue (~190 rows) is fetched on first focus, not on page load, to keep the landing page light. */
let cache: MarketService[] | null = null;
let inflight: Promise<MarketService[]> | null = null;
const loadServices = (): Promise<MarketService[]> => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetchBookingEngineServices()
      .then((rows) => (cache = rows))
      .finally(() => { inflight = null; });
  }
  return inflight;
};


const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'can', 'for', 'from', 'get', 'i', 'in',
  'is', 'it', 'me', 'my', 'of', 'on', 'or', 'please', 'the', 'to', 'we',
  'what', 'with', 'you', 'your', 'need', 'want', 'looking', 'like', 'book',
  'service', 'services', 'bed', 'beds', 'bedroom', 'bedrooms',
]);

const searchWords = (value: string) =>
  value.toLocaleLowerCase('en')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[\s\-–/&(),.]+/)
    .filter((word) => word && !SEARCH_STOP_WORDS.has(word) && !/^\d+$/.test(word) && !/^\d+br$/.test(word));

function serviceSearchFields(service: MarketService) {
  return {
    name: service.name.toLocaleLowerCase('en'),
    code: (service.service_code || '').toLocaleLowerCase('en'),
    details: [
      service.short_description,
      service.description,
      ...(Array.isArray(service.service_features) ? service.service_features : []),
    ].filter(Boolean).join(' ').toLocaleLowerCase('en'),
  };
}

/** Search descriptive service data without relying on the legacy category column. */
function rankBookingServices(services: MarketService[], query: string): MarketService[] {
  const terms = searchWords(query);
  if (!terms.length) return [];

  const phrase = query.trim().toLocaleLowerCase('en');
  const ranked = services.map((service) => {
    const fields = serviceSearchFields(service);
    const haystack = fields.name + ' ' + fields.code + ' ' + fields.details;
    let matchedTerms = 0;
    let score = 0;

    for (const term of terms) {
      const alternatives = [term];
      let best = 0;

      for (const alternative of alternatives) {
        const value = alternative.toLocaleLowerCase('en');
        if (fields.name.includes(value)) best = Math.max(best, value.length > 4 ? 12 : 10);
        if (fields.code.includes(value)) best = Math.max(best, 7);
        if (fields.details.includes(value)) best = Math.max(best, 4);
        if (haystack.split(/[^a-z0-9]+/).some((part) => part.startsWith(value))) {
          best = Math.max(best, 3);
        }
      }

      if (best > 0) {
        matchedTerms += 1;
        score += best;
      }
    }

    if (phrase.length >= 4 && fields.name.includes(phrase)) score += 18;
    const coverage = matchedTerms / terms.length;
    const minimumMatches = terms.length <= 2 ? 1 : Math.max(1, Math.ceil(terms.length * 0.35));
    return { service, score, matchedTerms, coverage, minimumMatches };
  });

  return ranked
    .filter((item) => item.matchedTerms >= item.minimumMatches && item.score > 0)
    .sort((a, b) => b.coverage - a.coverage || b.score - a.score || a.service.name.localeCompare(b.service.name))
    .slice(0, 8)
    .map((item) => item.service);
}

const serviceContextPrompt = () => 'Describe the items or areas that need attention, their current condition and any special concerns. A brief description is enough.';

type BookingValueOffer = {
  id: string; title: string; description: string | null; terms: string | null;
  offer_type: string; price_mode: string; price_value: number | null; currency: string;
  featured: boolean; relatedServices: { service_id: string; relationship: string; serviceName: string }[];
};

function Highlight({ text, q }: { text: string; q: string }) {
  const terms = searchWords(q).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${terms.join('|')})`, 'ig'));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="bg-transparent font-extrabold text-[#0F766E]">{p}</mark> : p))}</>;
}

/* Advertising pixel events — only after optional tracking consent. */
function trackPixel(event: string, params?: Record<string, unknown>) {
  try {
    if (localStorage.getItem('ccs_cookie_consent_v3') !== 'accepted') return;

    const pixelWindow = window as any;

    if (typeof pixelWindow.fbq === 'function') {
      pixelWindow.fbq('track', event, params);
    }

    if (typeof pixelWindow.ttq?.track === 'function') {
      pixelWindow.ttq.track(event, params);
    }
  } catch {
    /* Tracking must never interrupt the booking experience. */
  }
}

const isoDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function normalizeCustomerPhone(value: string): string {
  const phone = value.trim().replace(/[()\s-]/g, '');
  if (/^0[17]\d{8}$/.test(phone)) return `+254${phone.slice(1)}`;
  if (/^254[17]\d{8}$/.test(phone)) return `+${phone}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : '';
}

function useCountUp(target: number) {
  const [value, setValue] = useState(target);
  const prev = useRef(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); prev.current = target; return; }
    const from = prev.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 650);
      setValue(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick); else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-2 text-sm font-semibold transition ${on ? 'border-[#0F172A] bg-[#0F172A] text-white' : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#0F172A]'}`;

export default function BookingEngine({ phone }: { phone: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedServiceId = searchParams.get('service');
  const { user, loading: authLoading, isCustomer, customerClient } = useAuth();
  const globalDiscount = useGlobalDiscount();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [services, setServices] = useState<MarketService[]>(cache || []);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<MarketService | null>(null);
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [showDateInput, setShowDateInput] = useState(false);
  const [time, setTime] = useState('');
  const [size, setSize] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [interestedOfferIds, setInterestedOfferIds] = useState<string[]>([]);
  const [valueOffers, setValueOffers] = useState<BookingValueOffer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const today = isoDate(new Date());
  const tomorrow = isoDate(new Date(Date.now() + 86_400_000));

  const ensureLoaded = () => {
    if (cache || loading) return;
    setLoading(true); setFailed(false);
    loadServices().then(setServices).catch(() => setFailed(true)).finally(() => setLoading(false));
  };

  // Deep links from service detail pages must restore the exact selected service.
  useEffect(() => {
    if (!requestedServiceId) return;
    let live = true;
    setLoading(true);
    setFailed(false);
    loadServices()
      .then((rows) => {
        if (!live) return;
        setServices(rows);
        const match = rows.find((service) => service.id === requestedServiceId || service.slug === requestedServiceId);
        if (!match) {
          setSubmitError('That service is no longer available. Please choose another service or contact our team.');
          return;
        }
        setSubmitError('');
        setSelected(match);
        setQuery(match.name);
        setOpen(false);
        if (window.location.hash === '#booking') {
          requestAnimationFrame(() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
      })
      .catch(() => {
        if (live) {
          setFailed(true);
          setSubmitError('We could not load that service. Please try again or contact our team.');
        }
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [requestedServiceId]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    let live = true;
    fetchBookingEngineCategories()
      .then((rows) => {
        if (!live) return;
        setCategories([...rows].sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => { /* chips are optional; search still works */ });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const selectedId = selected?.id;
    if (!selectedId) { setValueOffers([]); return; }
    let live = true;
    (async () => {
      try {
        const triggerLinks = await supabase
          .from('booking_engine_value_offer_services')
          .select('offer_id')
          .eq('service_id', selectedId)
          .eq('relationship', 'trigger');
        if (triggerLinks.error) throw triggerLinks.error;
        const offerIds = [...new Set((triggerLinks.data || []).map((row: any) => row.offer_id))];
        if (!offerIds.length) { if (live) setValueOffers([]); return; }

        const offerResult = await supabase
          .from('booking_engine_value_offers')
          .select('id,title,description,terms,offer_type,price_mode,price_value,currency,featured,starts_at,ends_at,display_order')
          .in('id', offerIds)
          .eq('active', true)
          .order('display_order');
        if (offerResult.error) throw offerResult.error;
        const now = Date.now();
        const activeOffers = (offerResult.data || []).filter((offer: any) =>
          (!offer.starts_at || new Date(offer.starts_at).getTime() <= now) &&
          (!offer.ends_at || new Date(offer.ends_at).getTime() > now)
        );
        if (!activeOffers.length) { if (live) setValueOffers([]); return; }

        const linksResult = await supabase
          .from('booking_engine_value_offer_services')
          .select('offer_id,service_id,relationship')
          .in('offer_id', activeOffers.map((offer: any) => offer.id))
          .neq('relationship', 'trigger');
        if (linksResult.error) throw linksResult.error;
        const relatedIds = [...new Set((linksResult.data || []).map((row: any) => row.service_id))];
        const serviceResult = relatedIds.length
          ? await supabase.from('services').select('id,name').in('id', relatedIds)
          : { data: [], error: null };
        if (serviceResult.error) throw serviceResult.error;
        const names = new Map((serviceResult.data || []).map((service: any) => [service.id, service.name]));
        const mapped = activeOffers.map((offer: any) => ({
          ...offer,
          relatedServices: (linksResult.data || [])
            .filter((link: any) => link.offer_id === offer.id)
            .map((link: any) => ({
              service_id: link.service_id,
              relationship: link.relationship,
              serviceName: names.get(link.service_id) || 'Additional service',
            })),
        }));
        if (live) setValueOffers(mapped);
      } catch {
        if (live) setValueOffers([]);
      }
    })();
    return () => { live = false; };
  }, [selected?.id]);

  const pool = useMemo(() => (category ? services.filter((s) => s.category === category) : services), [services, category]);
  const results = useMemo(() => rankBookingServices(pool, query), [pool, query]);
  const featured = useMemo(() => groupByCategory(services).map(([, items]) => items[0]), [services]);
  const list = query.trim() ? results : category ? pool.slice(0, 8) : featured;

  const perSqm = !!selected && selected.base_price <= 0 && selected.price_per_sqm > 0;
  const contextPrompt = serviceContextPrompt();
  const selectedValueOffers = useMemo(
    () => valueOffers.filter((offer) => interestedOfferIds.includes(offer.id)),
    [valueOffers, interestedOfferIds],
  );
  const combinedCustomerNotes = [
    customerNotes.trim(),
    selectedValueOffers.length
      ? 'Value offers/packages of interest (not included in this estimate; eligibility and final price to be confirmed): ' + selectedValueOffers.map((offer) => offer.title + ' [' + offer.id + ']').join(', ')
      : '',
  ].filter(Boolean).join('\n').slice(0, 1000);
  const sizeNum = Number(size) || 0;
  const ready = !!selected && location.trim().length > 1 && !!date && !!time && (!perSqm || sizeNum > 0);
  const basePrice = selected ? (perSqm ? selected.price_per_sqm * sizeNum : startingPrice(selected)) : 0;
  const pricing = applyGlobalDiscount(basePrice, globalDiscount);
  const shownTotal = useCountUp(ready ? pricing.final : 0);
  const normalizedCustomerPhone = normalizeCustomerPhone(customerPhone);
  const validCustomerPhone = Boolean(normalizedCustomerPhone);
  const submissionReady = ready && !submitting && (
    authLoading
      ? false
      : user
        ? isCustomer && !!customerClient
        : validCustomerPhone
  );

  const choose = (s: MarketService) => {
    setSelected(s); setInterestedOfferIds([]); setOpen(false); setQuery(s.name);
    trackPixel('ViewContent', { content_name: s.name, content_category: s.category, value: startingPrice(s), currency: 'KES' });
  };

  const change = () => {
    setSelected(null); setInterestedOfferIds([]); setValueOffers([]); setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const go = async (mode: 'booking' | 'quotation') => {
    if (!selected || !ready || submitting) return;

    setSubmitError('');

    // Never send an authenticated account through the public guest endpoint.
    if (authLoading) {
      setSubmitError('Your account is still loading. Please try again in a moment.');
      return;
    }

    if (user) {
      if (!isCustomer) {
        setSubmitError('Please use the appropriate staff or agent portal for this request.');
        return;
      }

      if (!customerClient) {
        setSubmitError('Your customer profile is still being linked. Please wait a moment and try again.');
        return;
      }

      // Continue through the existing customer booking/quotation workflow.
      const params = new URLSearchParams({
        date,
        time,
        location: location.trim(),
      });

      if (perSqm) params.set('size', String(sizeNum));
      if (mode === 'quotation') params.set('mode', 'quote');

      navigate(`/service/${encodeURIComponent(selected.id)}?${params.toString()}`, {
        state: { bookingNotes: combinedCustomerNotes },
      });
      return;
    }

    // Guided services must use their configured question and pricing flow.
    const guidedConfig = await supabase
      .from('booking_engine_service_config')
      .select('id')
      .eq('service_id', selected.id)
      .eq('enabled', true)
      .maybeSingle();

    if (guidedConfig.error) {
      setSubmitError('We could not verify this service booking setup. Please try again.');
      return;
    }

    if (guidedConfig.data) {
      const guidedParams = new URLSearchParams({ date, time, location: location.trim() });
      if (mode === 'quotation') guidedParams.set('mode', 'quote');
      navigate(`/service/${encodeURIComponent(selected.id)}?${guidedParams.toString()}`);
      return;
    }

    // Guests must provide a valid international phone number.
    if (!validCustomerPhone) {
      setSubmitError('Enter a valid phone number with country code, e.g. +254712345678.');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('submit-guest-service-request', {
        body: {
          request_type: mode,
          service_id: selected.id,
          customer_name: customerName.trim(),
          customer_phone: normalizedCustomerPhone,
          location: location.trim(),
          customer_notes: combinedCustomerNotes || null,
          preferred_date: date,
          preferred_time: time,
          size_sqm: perSqm ? sizeNum : null,
          estimated_amount: pricing.final,
          discount_amount: pricing.discountAmount,
        },
      });

      if (error) throw error;
      if (!data?.success || !data?.request_reference) {
        throw new Error(data?.error || 'We could not save your request. Please try again.');
      }

      trackPixel('InitiateCheckout', {
        content_name: selected.name,
        value: pricing.final,
        currency: 'KES',
      });

      const requestLabel = mode === 'booking' ? 'Booking request' : 'Quotation request';
      const message = [
        `Hello Concept Cleaning Services, I have submitted a ${requestLabel.toLowerCase()}.`,
        '',
        `Request reference: ${data.request_reference}`,
        `Service: ${data.service_name || selected.name}`,
        `Name: ${customerName.trim() || 'Not provided'}`,
        `Phone: ${normalizedCustomerPhone}`,
        `Location: ${location.trim()}`,
        ...(combinedCustomerNotes ? [`Job details: ${combinedCustomerNotes}`] : []), 
        `Preferred date: ${date}`,
        `Preferred time: ${time}`,
        ...(perSqm ? [`Size: ${sizeNum} sq m`] : []),
        `Estimated amount: ${formatKes(pricing.final)}`,
        '',
        'Please contact me to confirm availability and the final price. I understand this is a request, not a confirmed booking.',
      ].join('\\n');

      // Redirect only after the server confirms that the request has been saved.
      rememberGuestWhatsAppRequest({
        requestReference: data.request_reference,
        serviceName: data.service_name || selected.name,
        requestType: mode,
      });
      window.location.assign(waLink(phone, message));
    } catch (error: any) {
      setSubmitError(
        error?.message || 'We could not submit your request. Please try again.'
      );
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, Math.max(list.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && list[active]) { e.preventDefault(); choose(list[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const waNoMatch = waLink(phone, `Hello Concept Cleaning Services, I am looking for: ${query.trim()}`);

  return (
    <section id="booking" aria-label="Book a service" className="relative w-full overflow-visible rounded-[26px] border border-slate-200/80 bg-white text-slate-900 shadow-[0_24px_70px_-35px_rgba(15,23,42,.35)]">
      <style>{`
        .be-rise{animation:be-rise .35s ease both}
        @keyframes be-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .be-field{height:48px;width:100%;border:1px solid #dbe2ea;border-radius:12px;background:#fff;padding:0 13px;font-size:14px;font-weight:600;color:#172033;outline:none;transition:border-color .18s,box-shadow .18s}
        .be-field:focus{border-color:#f68b1e;box-shadow:0 0 0 3px rgba(246,139,30,.13)}
        .be-textarea{width:100%;border:1px solid #dbe2ea;border-radius:12px;background:#fff;padding:12px 13px;font-size:14px;color:#172033;outline:none;transition:border-color .18s,box-shadow .18s}
        .be-textarea:focus{border-color:#f68b1e;box-shadow:0 0 0 3px rgba(246,139,30,.13)}
        .be-step{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8}
        .be-step-active{color:#fff}
        .be-step-dot{display:grid;height:27px;width:27px;place-items:center;border-radius:999px;background:rgba(255,255,255,.12);color:#fff;font-size:11px}
        .be-step-active .be-step-dot{background:#f68b1e;color:#fff;box-shadow:0 0 0 4px rgba(246,139,30,.13)}
        @media (prefers-reduced-motion:reduce){.be-rise{animation:none}}
      `}</style>
      <div className="rounded-t-[25px] bg-gradient-to-r from-[#172033] via-[#202b3d] to-[#303b4d] px-5 py-5 text-white sm:px-7 sm:py-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#ffbd75]">Concept Cleaning · Smart Booking</p><h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">Book your cleaning, your way.</h2><p className="mt-1 max-w-xl text-xs leading-5 text-white/70 sm:text-sm">Choose a service, tell us about your space and request your preferred time. Our team will confirm the details.</p></div>
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold text-white/85"><span className="h-2 w-2 rounded-full bg-emerald-400" />LIVE SERVICE CATALOGUE</div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2"><div className="be-step be-step-active"><span className="be-step-dot">1</span>Choose service</div><div className="hidden h-px w-8 bg-white/20 sm:block" /><div className={`be-step ${selected ? 'be-step-active' : ''}`}><span className="be-step-dot">2</span>Job details</div><div className="hidden h-px w-8 bg-white/20 sm:block" /><div className="be-step"><span className="be-step-dot">3</span>Request confirmation</div></div>
      </div>
      <div className="p-4 sm:p-6 lg:p-7">

      {!selected ? (
        <div ref={wrapRef} className="be-rise">
          <div className="mb-4"><h3 className="text-lg font-black tracking-tight text-[#172033] sm:text-xl">What service can we help you with?</h3><p className="mt-1 text-sm text-slate-500">Search by service name or browse a category below.</p></div>
          <div className="relative mt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 shadow-sm transition focus-within:border-[#f68b1e] focus-within:bg-white focus-within:ring-4 focus-within:ring-orange-100">
              <Search className="h-5 w-5 shrink-0 text-[#475569]" aria-hidden="true" />
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded={open}
                aria-controls="be-listbox"
                aria-autocomplete="list"
                aria-activedescendant={open && list[active] ? `be-opt-${active}` : undefined}
                aria-label="Search for a service"
                autoComplete="off"
                value={query}
                onFocus={() => { ensureLoaded(); setOpen(true); }}
                onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); ensureLoaded(); }}
                onKeyDown={onKeyDown}
                placeholder="Try “sofa”, “cockroaches”, “office”…"
                className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
              />
              {query && (
                <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="rounded-full p-1.5 text-[#475569] hover:bg-[#E2E8F0]">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {open && (
              <ul id="be-listbox" role="listbox" className="be-rise absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-auto rounded-2xl border border-[#E2E8F0] bg-white p-1.5 shadow-2xl">
                {loading && <li className="flex items-center gap-2 px-3 py-3 text-sm text-[#475569]"><Loader2 className="h-4 w-4 animate-spin" />Finding services…</li>}
                {failed && !loading && (
                  <li className="px-3 py-3 text-sm text-[#475569]">
                    Couldn’t load services. <button type="button" className="font-bold text-[#0F766E] underline" onClick={() => { ensureLoaded(); }}>Try again</button>
                  </li>
                )}
                {!loading && !failed && !query.trim() && <li role="presentation" className="px-3 pb-1 pt-2 text-xs font-bold text-[#475569]">{category || 'Popular'}</li>}
                {!loading && !failed && list.map((s, i) => {
                  const from = startingPrice(s);
                  return (
                    <li key={s.id} id={`be-opt-${i}`} role="option" aria-selected={i === active}
                      onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(s); }}
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${i === active ? 'bg-[#F1F5F9]' : ''}`}>
                      <ServiceVisual
                        image={serviceImage(s)}
                        alt={s.name}
                        className="h-14 w-16 shrink-0 rounded-lg object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold"><Highlight text={s.name} q={query} /></span>
                        <span className="block truncate text-xs text-[#475569]">{s.category}</span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-[#0F172A]">{from > 0 ? `from ${formatKes(from)}` : 'Quote'}</span>
                    </li>
                  );
                })}
                {!loading && !failed && query.trim() && results.length === 0 && services.length > 0 && (
                  <li role="presentation" className="px-3 py-3 text-sm text-[#475569]">
                    <p>No match for “{query.trim()}”.</p>
                    <a href={waNoMatch} onClick={() => trackPixel('Contact', { content_name: 'whatsapp_no_match' })} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 font-bold text-[#0F766E] underline">
                      <MessageCircle className="h-4 w-4" />Ask us on WhatsApp
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>

          {categories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Browse by category">
              {categories.map((c) => (
                <button key={c} type="button" aria-pressed={category === c} className={chip(category === c)}
                  onClick={() => { setCategory(category === c ? '' : c); setActive(0); setOpen(true); ensureLoaded(); inputRef.current?.focus(); }}>{c}</button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="be-rise">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#d97706]">Step 2 of 3</p><h3 className="mt-1 text-lg font-black text-[#172033]">Tell us about your booking</h3><p className="mt-1 text-xs text-slate-500">A few details help us prepare an accurate response.</p></div><button type="button" onClick={change} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-[#f68b1e] hover:bg-orange-50 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Change service</button></div>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <ServiceVisual
              image={serviceImage(selected)}
              alt={selected.name}
              loading="eager"
              className="h-40 w-full object-cover sm:h-48"
            />
            <div className="bg-gradient-to-r from-slate-50 to-orange-50/70 p-4">
              <p className="text-xs font-bold text-[#475569]">{selected.category}{selected.estimated_duration ? ` · ${selected.estimated_duration}` : ''}</p>
              <h2 className="mt-0.5 text-lg font-black leading-snug">{selected.name}</h2>
              {selected.short_description && (
                <p className="mt-1 text-sm leading-6 text-[#475569]">{selected.short_description}</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            <label className="block md:col-span-1">
              <span className="text-sm font-bold">Service address / estate / building</span>
              <input type="text" required autoComplete="street-address" maxLength={500} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Spirittan Apartments, Pipeline, Embakasi" className="be-field mt-1.5" />
              <span className="mt-1 block text-xs text-[#64748B]">Include the estate, building, road or a nearby landmark. Add access details when our team contacts you.</span>
            </label>

            <div>
              <span className="text-sm font-bold">When?</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button type="button" className={chip(date === today && !showDateInput)} onClick={() => { setDate(today); setShowDateInput(false); }}>Today</button>
                <button type="button" className={chip(date === tomorrow && !showDateInput)} onClick={() => { setDate(tomorrow); setShowDateInput(false); }}>Tomorrow</button>
                <button type="button" className={chip(showDateInput)} onClick={() => setShowDateInput(true)}>Pick a date</button>
              </div>
              {showDateInput && <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Service date" className="mt-2 h-11 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold" />}
              <label className="mt-3 block">
                <span className="text-sm font-bold">What time?</span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1.5 h-12 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold outline-none focus:border-[#0F172A]" />
              </label>
            </div>

            {perSqm && (
              <label className="block">
                <span className="text-sm font-bold">Size (sq m)</span>
                <input inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 20" className="mt-1.5 h-12 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold outline-none focus:border-[#0F172A]" />
              </label>
            )}
            <label className="block md:col-span-2">
              <span className="text-sm font-bold">A few details about the job <span className="font-normal text-[#64748B]">(optional)</span></span>
              <textarea
                rows={3}
                maxLength={650}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder={contextPrompt}
                className="be-textarea mt-1.5 resize-y"
              />
              <span className="mt-1 block text-xs text-[#64748B]">These details help us understand the job before confirming the price and appointment.</span>
            </label>
          </div>

          {valueOffers.length > 0 && (
            <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-[#172033]">Packages and value offers</p>
                  <p className="mt-1 text-xs text-[#64748B]">Optional offers configured by Concept Cleaning. Choose any you would like our team to consider.</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#475569]">Optional</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {valueOffers.map((offer) => {
                  const isInterested = interestedOfferIds.includes(offer.id);
                  const configuredPrice = offer.price_mode === 'fixed'
                    ? 'Configured offer price: ' + formatKes(Number(offer.price_value) || 0)
                    : offer.price_mode === 'fixed_discount'
                      ? 'Configured discount: ' + formatKes(Number(offer.price_value) || 0)
                      : offer.price_mode === 'percentage_discount'
                        ? 'Configured discount: ' + String(offer.price_value) + '%'
                        : 'Price confirmed after review';
                  const included = offer.relatedServices.filter((x) => x.relationship === 'included').map((x) => x.serviceName);
                  const recommended = offer.relatedServices.filter((x) => x.relationship === 'recommended').map((x) => x.serviceName);
                  return (
                    <button
                      key={offer.id}
                      type="button"
                      aria-pressed={isInterested}
                      onClick={() => setInterestedOfferIds((current) =>
                        isInterested
                          ? current.filter((id) => id !== offer.id)
                          : current.length < 3 ? [...current, offer.id] : current
                      )}
                      className={'flex min-h-20 flex-col gap-2 rounded-xl border px-3 py-3 text-left transition ' + (isInterested ? 'border-[#0F766E] bg-white text-[#0F766E]' : 'border-[#E2E8F0] bg-white text-[#172033] hover:border-[#94A3B8]')}
                    >
                      <span className="flex w-full items-start justify-between gap-2">
                        <span className="font-bold">{offer.title}</span>
                        <span className="shrink-0 text-xs font-bold">{isInterested ? 'Selected' : 'Add +'}</span>
                      </span>
                      <span className="text-xs text-[#475569]">{offer.description || offer.offer_type.replace('_', ' ')}</span>
                      <span className="text-xs font-semibold text-[#0F766E]">{configuredPrice}</span>
                      {included.length > 0 && <span className="text-xs text-[#475569]">Includes: {included.join(', ')}</span>}
                      {recommended.length > 0 && <span className="text-xs text-[#475569]">Also consider: {recommended.join(', ')}</span>}
                      {offer.terms && <span className="text-xs text-[#64748B]">{offer.terms}</span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[#64748B]">
                Selected offers are added to your request for review. They do not change this estimate or become confirmed services until our team verifies eligibility and pricing.
              </p>
            </div>
          )}

          {authLoading ? (
            <p className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#475569]">
              Checking your account…
            </p>
          ) : user ? (
            <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              {isCustomer && customerClient ? (
                <>
                  <p className="text-sm font-bold text-[#172033]">Your customer profile will be used</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    We’ll use the contact details already linked to your Concept Cleaning customer account.
                  </p>
                </>
              ) : isCustomer ? (
                <p className="text-sm text-[#475569]">
                  Your customer profile is still being linked. Please wait a moment before continuing.
                </p>
              ) : (
                <p className="text-sm text-[#475569]">
                  This booking option is for customers. Please use the appropriate staff or agent portal.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold">Your name <span className="font-normal text-[#64748B]">(optional)</span></span>
                <input
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your full name"
                  className="mt-1.5 h-12 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold outline-none focus:border-[#0F172A]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold">Your phone number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={16}
                  required
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value.replace(/[^0-9+]/g, ''));
                    setSubmitError('');
                  }}
                  placeholder="0712345678 or +254712345678"
                  aria-invalid={customerPhone.length > 0 && !validCustomerPhone}
                  className="mt-1.5 h-12 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold outline-none focus:border-[#0F172A]"
                />
                <span className="mt-1 block text-xs text-[#64748B]">
                  Kenyan numbers starting with 0 or 254 are converted automatically.
                </span>
              </label>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-orange-50/50 p-5" aria-live="polite">
            {ready ? (
              <div className="be-rise">
                <p className="text-xs font-bold text-[#475569]">Estimated total</p>
                <p className="mt-0.5 text-3xl font-black tracking-tight">{formatKes(shownTotal)}</p>
                {pricing.active && (
                  <p className="mt-1 text-sm font-semibold text-[#0F766E]">{globalDiscount.label} · you save {formatKes(pricing.discountAmount)} <span className="font-normal text-[#475569] line-through">{formatKes(pricing.original)}</span></p>
                )}
                <p className="mt-1 text-xs text-[#475569]">Our team confirms the final price and your time slot.</p>
              </div>
            ) : (
              <p className="text-sm text-[#475569]">Add {perSqm ? 'where, when and size' : 'where and when'} to see your price.</p>
            )}
          </div>

          {submitError && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {submitError}
            </p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              disabled={!submissionReady}
              onClick={() => go('booking')}
              className="h-12 rounded-xl bg-[#f68b1e] font-extrabold text-white shadow-md shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-[#e77d10] disabled:opacity-40"
            >
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : <>Book now <ArrowRight className="ml-1.5 h-4 w-4" /></>}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!submissionReady}
              onClick={() => go('quotation')}
              className="h-12 rounded-xl border-slate-300 font-bold text-slate-800 transition hover:border-[#f68b1e] hover:bg-orange-50 disabled:opacity-40"
            >
              Get quotation
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-[#475569]">
            Your request is saved first. WhatsApp opens next so our team can follow up. This is not a confirmed booking.
          </p>
        </div>
      )}
      </div>
    </section>
  );
}