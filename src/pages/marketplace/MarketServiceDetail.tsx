import { Helmet } from 'react-helmet-async';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
// Dialog removed: instant booking / WhatsApp flow disabled
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  MarketService,
  formatKes,
  serviceImage,
  startingPrice,
} from '@/lib/marketplace';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
// notifyAdminsOfBooking removed: instant booking notifications disabled
import { listAdminUserIds, pushNotificationToUsers, triggerBrowserNotification } from '@/lib/customerNotifications';
import { useGlobalDiscount } from '@/hooks/useGlobalDiscount';
import { applyGlobalDiscount, globalDiscountReason } from '@/lib/globalDiscount';
import { trackServiceView } from '@/lib/marketplaceBehavior';
import { usePublicSettings } from '@/hooks/usePublicSettings';
import { waLink } from '@/components/public/PublicShell';

const normalizeGuestPhone = (value: string) => {
  const phone = value.trim().replace(/[()\s-]/g, '');
  if (/^0[17]\d{8}$/.test(phone)) return `+254${phone.slice(1)}`;
  if (/^254[17]\d{8}$/.test(phone)) return `+${phone}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : '';
};

const todayNairobi = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value || '';

  return `${part('year')}-${part('month')}-${part('day')}`;
};

export default function MarketServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const quoteMode = params.get('mode') === 'quote';

  const {
    user,
    isCustomer,
    customerClient,
    refreshProfile,
    loading: authLoading,
  } = useAuth();
  const { general } = usePublicSettings();
  const businessPhone = general.phone || '+254796563741';
  const globalDiscount = useGlobalDiscount();

  const [service, setService] = useState<MarketService | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // instant booking / WhatsApp confirmation removed

  const [form, setForm] = useState({
    customer_name: '',
    service_date: params.get('date') || '',
    service_time: params.get('time') || '',
    location: params.get('location') || '',
    phone: '',
    notes: params.get('size') ? `Size: ${params.get('size')} sq m` : '',
  });

  /*
   * Load service by either:
   * 1. SEO-friendly slug
   * 2. Existing UUID
   *
   * Examples:
   * /service/5x6-bed-cleaning
   * /service/0124a70d-bff7-4fec-bd3b-f9511ecb980d
   */
  useEffect(() => {
    if (!id) return;

    const loadService = async () => {
      setLoading(true);

      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id
        );

      const { data, error } = await ((supabase.from('services') as any)
        .select('id, name, slug, service_code, description, short_description, category, base_price, price_per_sqm, pricing_model, pricing_unit, is_active, image_url, estimated_duration, service_features')
        .eq(isUuid ? 'id' : 'slug', id)
        .maybeSingle());

      if (error) {
        console.error('Failed to load service:', error);
        setService(null);
      } else {
        setService(
          data
            ? ({
                ...(data as any),
                slug: (data as any).slug || null,
                service_features: Array.isArray(
                  (data as any).service_features
                )
                  ? (data as any).service_features
                  : [],
              } as MarketService)
            : null
        );
      }

      setLoading(false);
    };

    loadService();
  }, [id]);
  useEffect(() => { if (service) trackServiceView(service.category); }, [service]);

  /*
   * Pre-fill customer information when available.
   */
  useEffect(() => {
    if (customerClient) {
      setForm((f) => ({
        ...f,
        location: f.location || customerClient.location || '',
        phone: f.phone || customerClient.phone || '',
      }));
    }
  }, [customerClient]);

  /*
   * Send user to customer login while preserving
   * the SEO-friendly service URL and quotation mode.
   */
  const requireLogin = () => {
    const currentPath = `/service/${id}${window.location.search}`;

    navigate(
      `/customer-auth?next=${encodeURIComponent(currentPath)}`
    );
  };

  /*
   * Build the WhatsApp confirmation message using the
   * information already entered by the customer.
   *
   * The WhatsApp destination is Concept Cleaning Services.
   */
  // WhatsApp helpers removed

  const submit = async (mode: 'booking' | 'quotation') => {
    if (!service) return;

    if (authLoading) {
      toast({
        title: 'Please wait',
        description: 'We are checking your account. Try again shortly.',
      });
      return;
    }

    // Guest requests use the secure endpoint, not the customer CRM workflow.
    if (!user) {
      const guestPhone = normalizeGuestPhone(form.phone);
      const requestedSize = Number(params.get('size'));
      const isPerSqm = service.base_price <= 0 && service.price_per_sqm > 0;

      if (!form.customer_name.trim()) {
        toast({ title: 'Enter your name', variant: 'destructive' });
        return;
      }

      if (!guestPhone) {
        toast({
          title: 'Enter a valid phone number',
          description: 'Use a Kenyan number such as 0712345678 or +254712345678.',
          variant: 'destructive',
        });
        return;
      }

      if (!form.location.trim()) {
        toast({ title: 'Enter your location', variant: 'destructive' });
        return;
      }

      if (!form.service_date || !form.service_time.trim()) {
        toast({
          title: 'Select your preferred date and time',
          variant: 'destructive',
        });
        return;
      }

      if (form.service_date < todayNairobi()) {
        toast({
          title: 'Choose a valid service date',
          description: 'The preferred date cannot be in the past.',
          variant: 'destructive',
        });
        return;
      }

      if (isPerSqm && (!Number.isFinite(requestedSize) || requestedSize <= 0)) {
        toast({
          title: 'Enter the service area size',
          variant: 'destructive',
        });
        return;
      }

      setSaving(true);

      try {
        const { data, error } = await supabase.functions.invoke(
          'submit-guest-service-request',
          {
            body: {
              request_type: mode,
              service_id: service.id,
              customer_name: form.customer_name.trim(),
              customer_phone: guestPhone,
              customer_notes: form.notes.trim() || null,
              location: form.location.trim(),
              preferred_date: form.service_date,
              preferred_time: form.service_time.trim(),
              size_sqm:
                Number.isFinite(requestedSize) && requestedSize > 0
                  ? requestedSize
                  : null,
            },
          }
        );

        if (error) throw error;

        if (!data?.success || !data?.request_reference) {
          throw new Error(
            data?.error || 'We could not save your request. Please try again.'
          );
        }

        const requestLabel = mode === 'booking' ? 'booking request' : 'quotation request';
        const discountedPrice = Math.max(0, Number(data.estimated_amount) || 0);
        const discountAmount = Math.max(0, Number(data.discount_amount) || 0);

        const message = [
          'Hello Concept Cleaning Services,',
          '',
          `I'd like to submit a ${requestLabel} through your website.`,
          '',
          `Name: ${form.customer_name.trim()}`,
          `Phone: ${guestPhone}`,
          `Service: ${data.service_name || service.name}`,
          `Location: ${form.location.trim()}`,
          `Preferred date: ${form.service_date}`,
          `Preferred time: ${form.service_time.trim()}`,
          `Estimated price: ${discountedPrice > 0 ? formatKes(discountedPrice) : 'To be confirmed'}`,
          ...(discountAmount > 0 ? [`You save: ${formatKes(discountAmount)}`] : []),
          `Reference: ${data.request_reference}`,
          '',
          'Please confirm receipt and advise on the next steps.',
        ].join('\n');

        window.location.assign(waLink(businessPhone, message));
      } catch (error: any) {
        toast({
          title: 'Request not submitted',
          description: error?.message || 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }

      return;
    }

    if (!isCustomer || !customerClient) {
      return requireLogin();
    }

    if (mode === 'booking' && !form.service_date) {
      toast({
        title: 'Select a service date',
        variant: 'destructive',
      });
      return;
    }

    if (mode === 'booking' && !form.service_time.trim()) {
      toast({
        title: 'Select a service time',
        variant: 'destructive',
      });
      return;
    }

    if (!form.location.trim() || !form.phone.trim()) {
      toast({
        title: 'Location and phone are required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const requestedSize = Number(params.get('size'));
    const isPerSqm = service.base_price <= 0 && service.price_per_sqm > 0;
    const originalPrice =
      isPerSqm && Number.isFinite(requestedSize) && requestedSize > 0
        ? service.price_per_sqm * requestedSize
        : startingPrice(service);
    const pricing = applyGlobalDiscount(originalPrice, globalDiscount);

    const price = pricing.final;


    const requestNotes = [
      form.notes.trim(),
      form.service_time.trim()
        ? `Preferred time: ${form.service_time.trim()}`
        : '',
    ].filter(Boolean).join('\n') || null;

    const lineItems = [
      {
        service_id: service.id,
        service_name: service.name,
        quantity: 1,
        unit_price: pricing.original,
        discount_percent: pricing.percentage,
        discount_amount: pricing.discountAmount,
        total: price,
        notes: requestNotes,
      },
    ];

    const discountFields = pricing.active
      ? {
          subtotal: pricing.original,
          discount_amount: pricing.discountAmount,
          discount_type: 'percent',
          discount_value: pricing.percentage,
          discount_reason: globalDiscountReason(globalDiscount),
        }
      : {
          subtotal: pricing.original,
          discount_amount: 0,
        };

    try {
      // Create Lead record (for ALL requests - booking or quotation)
      let leadCode = '';
      const { data: leadNum } = await supabase.rpc('next_lead_code' as any);
      leadCode = (leadNum as string) || `LD-${Date.now()}`;

      const leadData = {
        lead_code: leadCode,
        full_name: customerClient.full_name,
        phone: form.phone.trim(),
        email: customerClient.email || null,
        location: form.location.trim(),
        service_interest: service.name,
        source: 'website',
        status: 'new',
        priority: 'normal',
        estimated_value: Math.max(0, price || 0),
        notes: requestNotes,
        created_by: user.id,
      };

      const { data: leadResult, error: leadError } = await supabase
        .from('leads')
        .insert(leadData as any)
        .select('id')
        .single();

      if (leadError) throw leadError;
      const leadId = leadResult?.id;

      // Branch based on mode
      if (mode === 'booking') {
        // Create Booking
        const { error: bookingError } = await supabase
          .from('bookings')
          .insert({
            agent_id: user.id,
            client_id: customerClient.id,
            client_name: customerClient.full_name,
            client_phone: form.phone.trim(),
            service_id: service.id,
            service_date: form.service_date,
            location: form.location.trim(),
            size_sqm:
              Number.isFinite(requestedSize) && requestedSize > 0
                ? requestedSize
                : null,
            price,
            status: 'pending',
            created_by_name: customerClient.full_name,
            created_by_role: 'customer',
            line_items: lineItems as any,
            ...discountFields,
          } as any);

        if (bookingError) throw bookingError;

        // Link lead to booking
        if (leadId) {
          await supabase
            .from('leads')
            .update({ status: 'converted', converted_client_id: customerClient.id })
            .eq('id', leadId);
        }

        // Notify admins of booking
        try {
          const adminIds = await listAdminUserIds();
          if (adminIds.length) {
            const body = `New booking from ${customerClient.full_name} for ${service.name} on ${form.service_date}`;
            triggerBrowserNotification('New booking created', body);
            await pushNotificationToUsers({
              user_ids: adminIds,
              type: 'booking',
              title: 'New booking created',
              body,
            client_id: customerClient.id,
              link: '/admin/bookings',
            });
            window.dispatchEvent(new Event('ccs-notifications-changed'));
          }
        } catch (e) {
          console.warn('Could not notify admins of booking:', e);
        }

        toast({
          title: 'Booking created successfully',
          description: `Service scheduled for ${form.service_date}`,
        });
      } else {
        // Create Quotation
        let quotationNumber = '';
        const { data: num } = await supabase.rpc('next_quotation_number' as any);
        quotationNumber = (num as string) || `QT-${Date.now()}`;

        const { error: quotationError } = await supabase
          .from('quotations')
          .insert({
            quotation_number: quotationNumber,
            client_name: customerClient.full_name,
            client_phone: form.phone.trim(),
            service_name: service.name,
            service_date: form.service_date || null,
            price,
            created_by: user.id,
            created_by_name: customerClient.full_name,
            created_by_role: 'customer',
            line_items: lineItems as any,
            ...discountFields,
          } as any);

        if (quotationError) throw quotationError;

        // Notify admins of quotation
        try {
          const adminIds = await listAdminUserIds();
          if (adminIds.length) {
            const body = `Quotation ${quotationNumber} requested by ${customerClient.full_name} for ${service.name}.`;
            triggerBrowserNotification('New quotation requested', body);
            await pushNotificationToUsers({
              user_ids: adminIds,
              type: 'quotation',
              title: 'New quotation requested',
              body,
            client_id: customerClient.id,
              link: '/admin/quotations',
            });
            window.dispatchEvent(new Event('ccs-notifications-changed'));
          }
        } catch (e) {
          console.warn('Could not notify admins of quotation:', e);
        }

        toast({
          title: 'Quotation requested',
          description: `Reference ${quotationNumber}. PDF will be generated.`,
        });
      }

      // Track Meta pixel lead event
      try {
        if (localStorage.getItem('ccs_cookie_consent_v2') === 'accepted') {
          const pixel = (window as any).fbq;
          if (typeof pixel === 'function') {
            pixel('track', 'Lead', {
              content_name: service.name,
              content_category: service.category,
              value: price,
              currency: 'KES',
            });
          }
        }
      } catch (trackingError) {
        console.warn('Meta Pixel Lead tracking failed:', trackingError);
      }

      await refreshProfile();
      navigate('/my/bookings');
    } catch (e: any) {
      console.error('Could not submit request:', e);

      toast({
        title: 'Could not submit request',
        description: e.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-[#5A5752]">
        Loading service…
      </div>
    );
  }

  if (!service) {
    return (
      <div className="p-6 text-sm text-[#5A5752]">
        Service not found.
      </div>
    );
  }

  const displaySize = Number(params.get('size'));
  const displayPerSqm =
    service.base_price <= 0 && service.price_per_sqm > 0;
  const displayOriginalPrice =
    displayPerSqm && Number.isFinite(displaySize) && displaySize > 0
      ? service.price_per_sqm * displaySize
      : startingPrice(service);
  const pricing = applyGlobalDiscount(displayOriginalPrice, globalDiscount);

  const price = pricing.final;

  const pageTitle = `${service.name} | Concept Cleaning Services`;
  const pageDescription =
    service.short_description ||
    service.description ||
    `Professional ${service.name.toLowerCase()} in Nairobi and surrounding areas. Book Concept Cleaning Services today.`;
  const seoUrl = `https://www.conceptcleaningservices.co.ke/service/${service.slug || service.id}`;
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: pageDescription,
    url: seoUrl,
    serviceType: service.category,
    areaServed: {
      '@type': 'City',
      name: 'Nairobi',
    },
    provider: {
      '@type': 'LocalBusiness',
      name: 'Concept Cleaning Services',
      url: 'https://www.conceptcleaningservices.co.ke/',
      telephone: '+254796563741',
    },
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={seoUrl} />
        <script type="application/ld+json">
          {JSON.stringify(serviceSchema)}
        </script>
      </Helmet>

      <div className="mx-auto max-w-6xl pb-8">
        <div className="relative mx-4 mt-4 overflow-hidden rounded-3xl border border-[#E4DFD2] shadow-[0_12px_32px_rgba(51,51,51,0.08)] md:mx-6 md:mt-6">
          <ServiceVisual
            image={serviceImage(service)}
            alt={service.name}
            className="h-64 w-full object-cover md:h-[380px]"
          />

          <button
            onClick={() => navigate(-1)}
            className="absolute left-3 top-3 rounded-full bg-white/90 p-2 shadow"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 p-4 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)] md:gap-10 md:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8A6A2B]">
                {service.category}
              </p>

              {service.service_code && (
                <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#5A5752]">
                  {service.service_code}
                </span>
              )}
            </div>

            <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-[#333333] md:text-3xl">
              {service.name}
            </h1>

            {service.estimated_duration && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#5A5752]">
                <Clock className="h-3.5 w-3.5" />
                Estimated duration: {service.estimated_duration}
              </p>
            )}

            <p className="mt-3 text-2xl font-extrabold tracking-tight text-[#333333]">
              {pricing.original > 0 ? (
                pricing.active ? (
                  <>
                    From {formatKes(pricing.final)}{' '}
                    <span className="text-sm font-normal text-[#5A5752] line-through">{formatKes(pricing.original)}</span>
                  </>
                ) : (
                  <>From {formatKes(pricing.original)}</>
                )
              ) : (
                'Price on quotation'
              )}
            </p>

            {pricing.active ? (
              <p className="mt-1 text-sm font-semibold text-[#333333]">
                {globalDiscount.label} · you save {formatKes(pricing.discountAmount)}
              </p>
            ) : null}
          </div>

          {(service.description ||
            service.short_description) && (
            <p className="text-sm leading-relaxed text-[#5A5752] md:col-start-1">
              {service.description ||
                service.short_description}
            </p>
          )}

          {service.service_features.length > 0 && (
            <ul className="space-y-1.5 md:col-start-1">
              {service.service_features.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8A6A2B]" />
                  {f}
                </li>
              ))}
            </ul>
          )}

          <Card className="h-fit border-[#E4DFD2] bg-white shadow-[0_10px_30px_rgba(51,51,51,0.05)] md:col-start-2 md:row-start-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {quoteMode
                  ? 'Request a quotation'
                  : 'Book this service'}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {!user && (
                <div className="space-y-1.5">
                  <Label htmlFor="customer_name">Your name</Label>
                  <Input
                    id="customer_name"
                    value={form.customer_name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        customer_name: e.target.value,
                      }))
                    }
                    placeholder="Enter your full name"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="service_date">
                  Preferred date{' '}
                  {user && isCustomer && quoteMode && (
                    <span className="text-[#5A5752]">
                      (optional)
                    </span>
                  )}
                </Label>

                <Input
                  id="service_date"
                  type="date"
                  min={todayNairobi()}
                  value={form.service_date}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      service_date: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="service_time">
                  Preferred time
                </Label>

                <Input
                  id="service_time"
                  type="time"
                  value={form.service_time}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      service_time: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location">
                  <MapPin className="mr-1 inline h-3.5 w-3.5" />
                  Service location
                </Label>

                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      location: e.target.value,
                    }))
                  }
                  placeholder="Estate, town"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">
                  <Phone className="mr-1 inline h-3.5 w-3.5" />
                  Phone number
                </Label>

                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="07xx xxx xxx"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">
                  Notes for our team
                </Label>

                <Textarea
                  id="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Size of house, number of seats, access details…"
                />
              </div>

              {!user ? (
                <p className="rounded-lg bg-[#F6F3EC] p-2 text-xs text-foreground">
                  No account needed. Send your request and our team
                  will contact you to confirm the details.
                </p>
              ) : !isCustomer ? (
                <p className="rounded-lg bg-[#F6F3EC] p-2 text-xs text-foreground">
                  Please use a customer account to request this service.
                </p>
              ) : null}

              <div className="rounded-lg border border-[#E4DFD2] bg-[#F6F3EC] p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#5A5752]">Estimated total</span>
                  <span className="font-bold text-[#333333]">{formatKes(pricing.original)}</span>
                </div>
                {pricing.active ? (
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="font-semibold text-[#333333]">Book now to save</span>
                    <span className="font-semibold text-[#333333]">{formatKes(pricing.discountAmount)}</span>
                  </div>
                ) : null}
                <p className="mt-1 text-[11px] text-[#5A5752]">
                  {form.service_date || 'Select date'}{form.service_time ? ` • ${form.service_time}` : ''} {form.location ? `• ${form.location}` : ''}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#333333] text-white hover:bg-[#45413B]"
                  disabled={saving}
                  onClick={() =>
                    submit(
                      quoteMode ? 'quotation' : 'booking'
                    )
                  }
                >
                  {saving
                    ? 'Submitting…'
                    : quoteMode
                      ? 'Request Quotation'
                      : !user
                        ? 'Send booking request'
                        : 'Book Now'}
                </Button>

                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() =>
                    submit(
                      quoteMode ? 'booking' : 'quotation'
                    )
                  }
                >
                  {quoteMode
                    ? !user ? 'Send booking request' : 'Book instead'
                    : 'Get quotation'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* WhatsApp booking confirmation removed */}
    </>
  );
}