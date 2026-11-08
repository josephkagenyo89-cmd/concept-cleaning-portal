/**
 * BookingEngine — Uber-style hero widget for the landing page.
 * Type what you need -> live matches from the `services` table -> pick one ->
 * add where/when -> price reveals -> Book now / Get quotation.
 *
 * Hand-off: the booking itself still happens on /service/:slug (auth, RLS, lead +
 * booking creation stay untouched). Two small companion edits in
 * src/pages/marketplace/MarketServiceDetail.tsx are needed so it reads what this sends:
 *
 *  1) Pre-fill the form from the URL (replace the initial useState value):
 *       const [form, setForm] = useState({
 *         service_date: params.get('date') || '',
 *         service_time: params.get('time') || '',
 *         location: params.get('location') || '',
 *         phone: '',
 *         notes: params.get('size') ? `Size: ${params.get('size')} sq m` : '',
 *       });
 *  2) Keep those params through login (inside requireLogin):
 *       const currentPath = `/service/${id}${window.location.search}`;
 *
 * Data: everything shown comes from Supabase. Services via fetchMarketServices(), categories via
 * fetchMarketCategories(), prices via startingPrice(), discounts via useGlobalDiscount(). Nothing is hardcoded
 * (CATEGORY_ORDER is only used to sort categories).
 *
 * Note: for per-sq-m services this widget estimates price from the size entered;
 * the detail page still prices at startingPrice(), so confirm the total there.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, ArrowRight, Loader2, MapPin, MessageCircle, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { waLink } from '@/components/public/PublicShell';
import {
  CATEGORY_ORDER,
  MarketService,
  fetchBookingEngineCategories,
  fetchBookingEngineServices,
  formatKes,
  groupByCategory,
  startingPrice
} from '@/lib/marketplace';
import { useGlobalDiscount } from '@/hooks/useGlobalDiscount';
import { applyGlobalDiscount } from '@/lib/globalDiscount';

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

const SYNONYMS: Record<string, string[]> = {
  couch: ['sofa'], sofas: ['sofa'], seat: ['sofa', 'upholster'], rug: ['carpet'], rugs: ['carpet'],
  bug: ['pest', 'fumigat'], bugs: ['pest', 'fumigat'], bedbug: ['bed bug', 'fumigat'], bedbugs: ['bed bug', 'fumigat'],
  cockroach: ['pest', 'fumigat'], cockroaches: ['pest', 'fumigat'], roach: ['pest'], termite: ['pest', 'fumigat'],
  termites: ['pest', 'fumigat'], rat: ['pest'], rats: ['pest'], mosquito: ['pest', 'fumigat'], fleas: ['pest'],
  house: ['residential'], home: ['residential'], apartment: ['residential'], flat: ['residential'],
  shop: ['commercial'], office: ['commercial', 'office'], vehicle: ['car'],
};

const words = (s: string) => s.toLowerCase().split(/[\s\-–/&(),]+/).filter(Boolean);

function rank(services: MarketService[], q: string): MarketService[] {
  const terms = words(q);
  if (!terms.length) return [];
  const scored: [MarketService, number][] = [];
  for (const s of services) {
    const name = s.name.toLowerCase();
    const cat = s.category.toLowerCase();
    const code = (s.service_code || '').toLowerCase();
    const nameWords = words(name);
    let total = 0;
    for (const t of terms) {
      let best = 0;
      [t, ...(SYNONYMS[t] || [])].forEach((a, i) => {
        const w = i === 0 ? 1 : 0.6;
        const v = name.startsWith(a) ? 10
          : nameWords.some((x) => x.startsWith(a)) ? 8
          : name.includes(a) ? 5
          : code && code.includes(a) ? 4
          : cat.includes(a) ? 3 : 0;
        best = Math.max(best, v * w);
      });
      if (!best) { total = 0; break; }
      total += best;
    }
    if (total > 0) scored.push([s, total]);
  }
  return scored.sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name)).slice(0, 8).map((x) => x[0]);
}

function Highlight({ text, q }: { text: string; q: string }) {
  const terms = words(q).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${terms.join('|')})`, 'ig'));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="bg-transparent font-extrabold text-[#0F766E]">{p}</mark> : p))}</>;
}

/* Meta Pixel events — only after cookie consent (same guard as the booking flow). */
function trackPixel(event: string, params?: Record<string, unknown>) {
  try {
    if (localStorage.getItem('ccs_cookie_consent_v2') !== 'accepted') return;
    const fbq = (window as any).fbq;
    if (typeof fbq === 'function') fbq('track', event, params);
  } catch { /* tracking must never break booking */ }
}

const isoDate = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

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
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const today = isoDate(new Date());
  const tomorrow = isoDate(new Date(Date.now() + 86_400_000));

  const ensureLoaded = () => {
    if (cache || loading) return;
    setLoading(true); setFailed(false);
    loadServices().then(setServices).catch(() => setFailed(true)).finally(() => setLoading(false));
  };

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
        const order = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i < 0 ? 99 : i; };
        setCategories([...rows].sort((a, b) => order(a) - order(b) || a.localeCompare(b)));
      })
      .catch(() => { /* chips are optional; search still works */ });
    return () => { live = false; };
  }, []);

  const pool = useMemo(() => (category ? services.filter((s) => s.category === category) : services), [services, category]);
  const results = useMemo(() => rank(pool, query), [pool, query]);
  const featured = useMemo(() => groupByCategory(services).map(([, items]) => items[0]), [services]);
  const list = query.trim() ? results : category ? pool.slice(0, 8) : featured;

  const perSqm = !!selected && selected.base_price <= 0 && selected.price_per_sqm > 0;
  const sizeNum = Number(size) || 0;
  const ready = !!selected && location.trim().length > 1 && !!date && !!time && (!perSqm || sizeNum > 0);
  const basePrice = selected ? (perSqm ? selected.price_per_sqm * sizeNum : startingPrice(selected)) : 0;
  const pricing = applyGlobalDiscount(basePrice, globalDiscount);
  const shownTotal = useCountUp(ready ? pricing.final : 0);
  const validCustomerPhone = /^\+[1-9]\d{7,14}$/.test(customerPhone.trim());
  const submissionReady = ready && !submitting && (
    authLoading
      ? false
      : user
        ? isCustomer && !!customerClient
        : validCustomerPhone
  );

  const choose = (s: MarketService) => {
    setSelected(s); setOpen(false); setQuery(s.name);
    trackPixel('ViewContent', { content_name: s.name, content_category: s.category, value: startingPrice(s), currency: 'KES' });
  };

  const change = () => {
    setSelected(null); setOpen(true);
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

      navigate(`/service/${encodeURIComponent(selected.id)}?${params.toString()}`);
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
          customer_phone: customerPhone.trim(),
          location: location.trim(),
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
        `Phone: ${customerPhone.trim()}`,
        `Location: ${location.trim()}`,
        `Preferred date: ${date}`,
        `Preferred time: ${time}`,
        ...(perSqm ? [`Size: ${sizeNum} sq m`] : []),
        `Estimated amount: ${formatKes(pricing.final)}`,
        '',
        'Please contact me to confirm availability and the final price. I understand this is a request, not a confirmed booking.',
      ].join('\\n');

      // Redirect only after the server confirms that the request has been saved.
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
    <section aria-label="Book a service" className="w-full max-w-3xl rounded-3xl bg-white p-4 text-[#0F172A] shadow-2xl sm:p-6 lg:p-8">
      <style>{`.be-rise{animation:be-rise .35s ease both}@keyframes be-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.be-rise{animation:none}}`}</style>

      {!selected ? (
        <div ref={wrapRef} className="be-rise">
          <h2 className="text-xl font-black tracking-tight sm:text-2xl">What do you need today?</h2>
          <div className="relative mt-4">
            <div className="flex items-center gap-2 rounded-2xl bg-[#F1F5F9] px-4 ring-2 ring-transparent transition focus-within:bg-white focus-within:ring-[#0F172A]">
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
                className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:font-medium placeholder:text-[#64748B]"
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
                      <span className="min-w-0">
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
          <button type="button" onClick={change} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#475569] hover:text-[#0F172A]"><ArrowLeft className="h-4 w-4" />Change service</button>
          <div className="mt-3 rounded-2xl bg-[#F1F5F9] p-4">
            <p className="text-xs font-bold text-[#475569]">{selected.category}{selected.estimated_duration ? ` · ${selected.estimated_duration}` : ''}</p>
            <h2 className="mt-0.5 text-lg font-black leading-snug">{selected.name}</h2>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            <label className="block">
              <span className="text-sm font-bold">Where?</span>
              <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#E2E8F0] px-3 focus-within:border-[#0F172A]">
                <MapPin className="h-4 w-4 shrink-0 text-[#0F766E]" aria-hidden="true" />
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Estate or area" className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-medium placeholder:text-[#64748B]" />
              </span>
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
          </div>

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
                  placeholder="+254712345678"
                  aria-invalid={customerPhone.length > 0 && !validCustomerPhone}
                  className="mt-1.5 h-12 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold outline-none focus:border-[#0F172A]"
                />
                <span className="mt-1 block text-xs text-[#64748B]">
                  Include country code, e.g. +254. Do not start with 0.
                </span>
              </label>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-[#E2E8F0] p-4" aria-live="polite">
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
              className="h-12 rounded-xl bg-[#F97316] font-extrabold text-[#172033] hover:bg-[#FB923C] disabled:opacity-40"
            >
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : <>Book now <ArrowRight className="ml-1.5 h-4 w-4" /></>}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!submissionReady}
              onClick={() => go('quotation')}
              className="h-12 rounded-xl border-[#E2E8F0] font-bold disabled:opacity-40"
            >
              Get quotation
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-[#475569]">
            Your request is saved first. WhatsApp opens next so our team can follow up. This is not a confirmed booking.
          </p>
        </div>
      )}
    </section>
  );
}