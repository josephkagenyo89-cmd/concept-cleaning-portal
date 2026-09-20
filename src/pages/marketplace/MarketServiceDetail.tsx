import { Helmet } from 'react-helmet-async';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft,
  Star,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  MarketService,
  displayRating,
  formatKes,
  serviceImage,
  startingPrice,
} from '@/lib/marketplace';
import { useGlobalDiscount } from '@/hooks/useGlobalDiscount';
import { applyGlobalDiscount } from '@/lib/globalDiscount';
import { createBookingEngineRequest, addBookingEngineRequestItem, calculateBookingEngineRequestPrice, submitBookingEngineRequest, updateBookingEngineRequest } from '@/lib/bookingEngine';

export default function MarketServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const quoteMode = params.get('mode') === 'quote';

  const { user, isCustomer, customerClient, refreshProfile } = useAuth();
  const globalDiscount = useGlobalDiscount();

  const [service, setService] = useState<MarketService | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scopeAcknowledged, setScopeAcknowledged] = useState(false);
  const [bookingScope, setBookingScope] = useState<{ title: string; description: string } | null>(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');

  const [form, setForm] = useState({
    service_date: '',
    location: '',
    phone: '',
    service_time: '',
    notes: '',
  });

  useEffect(() => {
    if (!service?.id) return;

    const loadBookingScope = async () => {
      const { data: config } = await supabase
        .from('booking_engine_service_config')
        .select('id')
        .eq('service_id', service.id)
        .eq('enabled', true)
        .maybeSingle();

      if (!config) {
        setBookingScope(null);
        return;
      }

      const { data: scope } = await supabase
        .from('booking_engine_service_scope')
        .select('title, description')
        .eq('service_config_id', config.id)
        .eq('scope_type', 'included')
        .eq('active', true)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      setBookingScope(scope || null);
    };

    loadBookingScope();
  }, [service?.id]);


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
        .select('*')
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
    const currentPath = `/service/${id}${
      quoteMode ? '?mode=quote' : ''
    }`;

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
  const buildWhatsAppUrl = () => {
    const whatsappPhone = '254796563741';

    const message = [
      'Hello Concept Cleaning Services,',
      '',
      'I have submitted a booking request through your website and would like to confirm the details below:',
      '',
      `Client Name: ${customerClient?.full_name || 'N/A'}`,
      `Phone: ${form.phone.trim()}`,
      `Service: ${service?.name || 'N/A'}`,
      `Preferred Date: ${form.service_date || 'Not specified'}`,
      `Preferred Time: ${form.service_time || 'Not specified'}`,
      `Service Location: ${form.location.trim()}`,
      `Amount: ${formatKes(price)}`,
      form.notes.trim() ? `Notes: ${form.notes.trim()}` : '',
      '',
      'Please confirm my booking request.',
      '',
      'Concept Cleaning Services',
    ]
      .filter(Boolean)
      .join('\n');

    return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
      message
    )}`;
  };

  const handleOpenWhatsApp = () => {
    if (!whatsappUrl) return;

    window.open(
      whatsappUrl,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleWhatsAppDialogClose = () => {
    setWhatsappDialogOpen(false);
    navigate('/my/bookings');
  };

  const submit = async (mode: 'booking' | 'quotation') => {
    if (!service) return;

    if (!user || !isCustomer || !customerClient) {
      return requireLogin();
    }
    if (mode === 'booking' && (!form.service_date || !form.service_time)) {
      toast({
        title: form.service_date ? 'Select a preferred time' : 'Select a service date',
        variant: 'destructive',
      });
      return;
    }

    if (mode === 'booking' && bookingScope && !scopeAcknowledged) {
      toast({
        title: 'Please acknowledge the service scope',
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

    const pricing = applyGlobalDiscount(
      startingPrice(service),
      globalDiscount
    );

    const price = pricing.final;

    const lineItems = [
      {
        service_id: service.id,
        service_name: service.name,
        quantity: 1,
        unit_price: pricing.original,
        discount_percent: pricing.percentage,
        discount_amount: pricing.discountAmount,
        total: price,
        notes: form.notes || null,
      },
    ];

    const discountFields = pricing.active
      ? {
          subtotal: pricing.original,
          discount_amount: pricing.discountAmount,
          discount_reason: globalDiscount.label,
        }
      : {
          subtotal: pricing.original,
          discount_amount: 0,
        };

    try {
      if (mode === 'booking') {
          const requestId = await createBookingEngineRequest({
            requestedDate: form.service_date,
            requestedTime: form.service_time,
            serviceLocation: form.location.trim(),
            customerNotes: form.notes,
          });

          await updateBookingEngineRequest({
            requestId,
            requestedDate: form.service_date,
            requestedTime: form.service_time,
            serviceLocation: form.location.trim(),
            customerNotes: form.notes,
            acknowledgedScope: bookingScope ? scopeAcknowledged : true,
          });

          await addBookingEngineRequestItem({
            requestId,
            serviceId: service.id,
            quantity: 1,
            measurements: {},
            answers: {},
            selectedExtras: [],
          });

          const bookingPricing = await calculateBookingEngineRequestPrice(requestId);

          if ((bookingPricing as any)?.status !== 'priced') {
            throw new Error('This service requires a quotation.');
          }

          await submitBookingEngineRequest(requestId);



        /*
         * The booking has successfully been saved.
         * Only now prepare the WhatsApp confirmation dialog.
         */
        setWhatsappUrl(buildWhatsAppUrl());

        await refreshProfile();

        toast({
          title: 'Booking request sent',
          description: 'Our team will confirm shortly.',
        });

        setWhatsappDialogOpen(true);
      } else {
        let quotationNumber = '';

        const { data: num } = await supabase.rpc(
          'next_quotation_number' as any
        );

        quotationNumber =
          (num as string) || `QT-${Date.now()}`;

        const { error } = await supabase
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

        if (error) throw error;

        toast({
          title: 'Quotation requested',
          description: `Reference ${quotationNumber}`,
        });

        await refreshProfile();

        navigate('/my/bookings');
      }
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
      <div className="p-6 text-sm text-muted-foreground">
        Loading service…
      </div>
    );
  }

  if (!service) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Service not found.
      </div>
    );
  }

  const pricing = applyGlobalDiscount(
    startingPrice(service),
    globalDiscount
  );

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

      <div className="pb-6">
        <div className="relative">
          <img
            src={serviceImage(service)}
            alt={service.name}
            width={800}
            height={600}
            className="h-52 w-full object-cover"
          />

          <button
            onClick={() => navigate(-1)}
            className="absolute left-3 top-3 rounded-full bg-card/90 p-2 shadow"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4 md:space-y-6 md:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-market">
                {service.category}
              </p>

              {service.service_code && (
                <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                  {service.service_code}
                </span>
              )}
            </div>

            <h1 className="text-lg font-bold leading-snug">
              {service.name}
            </h1>

            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                {displayRating(service.id).toFixed(1)}
              </span>

              {service.estimated_duration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {service.estimated_duration}
                </span>
              )}
            </div>

            <p className="mt-2 text-xl font-bold text-market">
              {price > 0 ? (
                <>
                  From {formatKes(price)}{' '}
                  <span className="text-xs font-medium text-muted-foreground">
                    /{service.pricing_unit}
                  </span>
                </>
              ) : (
                'Price on quotation'
              )}
            </p>

            {pricing.active && (
              <p className="text-xs text-muted-foreground">
                <span className="line-through">
                  {formatKes(pricing.original)}
                </span>{' '}
                <span className="font-semibold text-destructive">
                  -{pricing.percentage}% ({globalDiscount.label})
                </span>{' '}
                · you save {formatKes(pricing.discountAmount)}
              </p>
            )}
          </div>

          {(service.description ||
            service.short_description) && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {service.description ||
                service.short_description}
            </p>
          )}

          {service.service_features.length > 0 && (
            <ul className="space-y-1.5">
              {service.service_features.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-market" />
                  {f}
                </li>
              ))}
            </ul>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {quoteMode
                  ? 'Request a quotation'
                  : 'Book this service'}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="service_date">
                  Preferred date{' '}
                  {quoteMode && (
                    <span className="text-muted-foreground">
                      (optional)
                    </span>
                  )}
                </Label>

                <Input
                  id="service_date"
                  type="date"
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
                <Label htmlFor="service_time">Preferred time</Label>
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

              {!isCustomer && (
                <p className="rounded-lg bg-market-soft p-2 text-xs text-foreground">
                  Sign in or create a customer account to
                  complete your request.
                </p>
              )}


                {bookingScope && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 mb-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="scope-acknowledgement"
                        checked={scopeAcknowledged}
                        onCheckedChange={(checked) =>
                          setScopeAcknowledged(checked === true)
                        }
                      />
                      <label
                        htmlFor="scope-acknowledgement"
                        className="cursor-pointer text-xs leading-relaxed text-foreground"
                      >
                        <span className="font-semibold">{bookingScope.title}:</span>{" "}
                        {bookingScope.description} I confirm that I have reviewed and acknowledge this service scope.
                      </label>
                    </div>
                  </div>
                )}

                <Button
                  className="flex-1 bg-market text-market-foreground hover:bg-market/90"
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
                    ? 'Book instead'
                    : 'Get quotation'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={whatsappDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleWhatsAppDialogClose();
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-hidden p-0">
          <div className="h-1.5 bg-market" />

          <div className="p-6">
            <DialogHeader>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-market-soft">
                <MessageCircle className="h-7 w-7 text-market" />
              </div>

              <DialogTitle className="text-center text-xl">
                Confirm your booking
              </DialogTitle>

              <DialogDescription className="text-center">
                Your booking request has been saved successfully.
                Send the booking details to Concept Cleaning
                Services on WhatsApp so our team can confirm your
                request.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-foreground">
                  Booking details
                </p>

                <span className="rounded-full bg-market-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-market">
                  Submitted
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Service
                  </span>
                  <span className="text-right font-medium text-foreground">
                    {service.name}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Name
                  </span>
                  <span className="text-right font-medium text-foreground">
                    {customerClient?.full_name}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Phone
                  </span>
                  <span className="text-right font-medium text-foreground">
                    {form.phone}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Date
                  </span>
                  <span className="text-right font-medium text-foreground">
                    {form.service_date}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Location
                  </span>
                  <span className="max-w-[60%] text-right font-medium text-foreground">
                    {form.location}
                  </span>
                </div>

                <div className="mt-3 border-t pt-3">
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-foreground">
                      Amount
                    </span>
                    <span className="font-bold text-market">
                      {formatKes(price)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-market/20 bg-market-soft/50 p-3 text-center text-xs text-muted-foreground">
              WhatsApp will open with your booking details
              already filled in. Simply review them and press
              <span className="font-semibold text-foreground">
                {' '}
                Send
              </span>
              .
            </div>

            <DialogFooter className="mt-5 flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleWhatsAppDialogClose}
              >
                Continue without WhatsApp
              </Button>

              <Button
                className="w-full bg-green-600 text-white shadow-sm hover:bg-green-700 sm:w-auto"
                onClick={handleOpenWhatsApp}
                disabled={!whatsappUrl}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Open WhatsApp
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}