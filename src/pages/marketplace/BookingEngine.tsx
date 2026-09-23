import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { createBookingEngineRequest, updateBookingEngineRequest, addBookingEngineRequestItem, updateBookingEngineRequestItem, submitBookingEngineRequest } from '@/lib/bookingEngine';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import BookingEngineQuestionFields, { type BookingEngineQuestion } from '@/components/marketplace/BookingEngineQuestionFields';
import { Loader2, ArrowLeft, ArrowRight, ClipboardList } from 'lucide-react';

interface BookingEngineService {
  id: string;
  configId: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category: string;
  base_price: number;
  pricing_model: string;
  pricing_unit: string;
  image_url: string | null;
  estimated_duration: string | null;
  customer_instructions: string | null;
}

export default function BookingEngine() {
  const { isCustomer } = useAuth();
  const [services, setServices] = useState<BookingEngineService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<BookingEngineService | null>(null);
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedTime, setRequestedTime] = useState('');
  const [serviceLocation, setServiceLocation] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [step, setStep] = useState(1);
  const [questions, setQuestions] = useState<BookingEngineQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [scopeItems, setScopeItems] = useState<Array<{ id: string; scope_type: string; title: string; description: string | null; display_order: number }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scopeAcknowledged, setScopeAcknowledged] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestItemId, setRequestItemId] = useState<string | null>(null);

  const handleSubmitRequest = async () => {
    if (!selectedService || !scopeAcknowledged) return;

    const missingRequiredQuestion = questions.find(question => {
      if (!question.required) return false;
      const value = answers[question.question_key];
      if (value === undefined || value === null || value === "") return true;
      if (Array.isArray(value) && value.length === 0) return true;
      return false;
    });

    if (missingRequiredQuestion) {
      setSubmitError(`Please answer: ${missingRequiredQuestion.label}`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      let currentRequestId = requestId;

      if (!currentRequestId) {
        currentRequestId = await createBookingEngineRequest({
          requestedDate,
          requestedTime,
          serviceLocation,
          customerNotes,
        });
        setRequestId(currentRequestId);
      }

      await updateBookingEngineRequest({
        requestId: currentRequestId,
        requestedDate,
        requestedTime,
        serviceLocation,
        customerNotes,
        acknowledgedScope: scopeAcknowledged,
      });

      let currentRequestItemId = requestItemId;

      if (!currentRequestItemId) {
        currentRequestItemId = await addBookingEngineRequestItem({
          requestId: currentRequestId,
          serviceId: selectedService.id,
          quantity: 1,
          answers,
        });
        setRequestItemId(currentRequestItemId);
      } else {
        await updateBookingEngineRequestItem({
          itemId: currentRequestItemId,
          quantity: 1,
          answers,
        });
      }

      await submitBookingEngineRequest(currentRequestId);

      const { data: submittedRequest, error: submittedRequestError } = await supabase
        .from("booking_engine_requests")
        .select("request_number")
        .eq("id", currentRequestId)
        .single();

      if (submittedRequestError) throw submittedRequestError;

      toast({
        title: "Request submitted successfully",
        description: `Your request ${submittedRequest.request_number} has been submitted and is now under review.`,
      });

      setRequestId(null);
      setRequestItemId(null);
    } catch (err) {
      console.error("Failed to submit Booking Engine request:", err);
      setSubmitError(err instanceof Error ? err.message : "Unable to submit your request.");
    } finally {
      setSubmitting(false);
    }
  };


  useEffect(() => {
    if (!selectedService || step !== 2) return;

    const loadQuestions = async () => {
      setQuestionsLoading(true);
      setQuestionError(null);

      try {
        const { data, error } = await supabase
          .from('booking_engine_questions')
          .select('id, service_config_id, question_key, label, description, input_type, required, display_order, options')
          .eq('service_config_id', selectedService.configId)
          .order('display_order')
          .order('created_at');

        if (error) throw error;

        setQuestions((data || []) as BookingEngineQuestion[]);

        const { data: scopeData, error: scopeError } = await supabase
          .from('booking_engine_service_scope')
          .select('id, scope_type, title, description, display_order')
          .eq('service_config_id', selectedService.configId)
          .eq('active', true)
          .order('scope_type')
          .order('display_order');

        if (scopeError) throw scopeError;

        setScopeItems(scopeData || []);
      } catch (err) {
        console.error('Failed to load Booking Engine questions:', err);
        setQuestionError('Unable to load service questions.');
        setQuestions([]);
      } finally {
        setQuestionsLoading(false);
      }
    };

    loadQuestions();
  }, [selectedService, step]);

  useEffect(() => {
    const loadServices = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: configs, error: configError } = await supabase
          .from('booking_engine_service_config')
          .select(
            'id, service_id, customer_instructions, photo_mode, photo_min, photo_max, measurement_config, availability_config, config_version'
          )
          .eq('enabled', true);

        if (configError) throw configError;

        const serviceIds = (configs || []).map((config) => config.service_id);

        if (serviceIds.length === 0) {
          setServices([]);
          return;
        }

        const { data: serviceRows, error: serviceError } = await supabase
          .from('services')
          .select(
            'id, name, short_description, description, category, base_price, pricing_model, pricing_unit, image_url, estimated_duration, is_active'
          )
          .in('id', serviceIds)
          .eq('is_active', true)
          .order('category')
          .order('name');

        if (serviceError) throw serviceError;

        const configByServiceId = new Map(
          (configs || []).map((config) => [config.service_id, config])
        );

        const mapped = (serviceRows || []).map((service) => {
          const config = configByServiceId.get(service.id);

          return {
            id: service.id,
            configId: config?.id || '',
            name: service.name,
            short_description: service.short_description,
            description: service.description,
            category: service.category,
            base_price: Number(service.base_price) || 0,
            pricing_model: service.pricing_model,
            pricing_unit: service.pricing_unit,
            image_url: service.image_url,
            estimated_duration: service.estimated_duration,
            customer_instructions: config?.customer_instructions || null,
          };
        });

        setServices(mapped);
      } catch (err) {
        console.error('Failed to load Booking Engine services:', err);
        setError('Unable to load Booking Engine services.');
      } finally {
        setLoading(false);
      }
    };

    if (isCustomer) {
      loadServices();
    } else {
      setLoading(false);
    }
  }, [isCustomer]);

  if (!isCustomer) {
    return null;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <ClipboardList className="h-5 w-5" />
            <span className="text-sm font-medium">Booking Engine</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Request a Cleaning Service
          </h1>

          <p className="mt-2 max-w-2xl text-muted-foreground">
            Tell us what you need. We&apos;ll review your request and guide you
            through the next steps.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : services.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="font-semibold">No services are available yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Please check again later or browse our regular services.
              </p>
              <Button asChild className="mt-4">
                <Link to="/categories">Browse Services</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          selectedService ? (
              <Card>
                <CardContent className="p-6">
                  <Button type="button" variant="ghost" className="mb-4 -ml-2" onClick={() => setSelectedService(null)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to services
                  </Button>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {selectedService.category}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold">{selectedService.name}</h2>
                    {selectedService.customer_instructions ? (
                      <p className="mt-2 text-sm text-muted-foreground">{selectedService.customer_instructions}</p>
                    ) : null}
                  </div>

                    {step === 1 ? (
                      <>


                  <div className="mt-6 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="requested-date">Preferred date</Label>
                      <Input
                        id="requested-date"
                        type="date"
                        value={requestedDate}
                        onChange={(event) => setRequestedDate(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="requested-time">Preferred time</Label>
                      <Input
                        id="requested-time"
                        type="time"
                        value={requestedTime}
                        onChange={(event) => setRequestedTime(event.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="service-location">Service location</Label>
                      <Input
                        id="service-location"
                        value={serviceLocation}
                        onChange={(event) => setServiceLocation(event.target.value)}
                        placeholder="Estate, town"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customer-notes">Notes for our team</Label>
                      <Textarea
                        id="customer-notes"
                        rows={4}
                        value={customerNotes}
                        onChange={(event) => setCustomerNotes(event.target.value)}
                        placeholder="Tell us anything we should know about the service."
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <Button
                      type="button"
                      disabled={!requestedDate || !requestedTime || !serviceLocation.trim()}
                      onClick={() => setStep(2)}
                    >
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>

                  </div>

                      </>
                  ) : (
                      questionsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : questionError ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                          {questionError}
                        </div>
                      ) : (
                        <>
                        <div className="mt-6 space-y-4 rounded-lg border p-4">
                          <div>
                            <h3 className="font-semibold">Service scope</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Please review the service scope before continuing.
                            </p>
                          </div>
                          {(["included", "excluded", "extra"] as const).map(scopeType => {
                            const items = scopeItems.filter(item => item.scope_type === scopeType);
                            if (items.length === 0) return null;
                            const heading = scopeType === "included" ? "Included" : scopeType === "excluded" ? "Excluded" : "Extras";
                            return (
                              <div key={scopeType} className="space-y-2">
                                <h4 className="text-sm font-medium">{heading}</h4>
                                {items.map(item => (
                                  <div key={item.id} className="rounded-md bg-muted/40 p-3">
                                    <p className="text-sm font-medium">{item.title}</p>
                                    {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                          <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
                            <Checkbox
                              checked={scopeAcknowledged}
                              onCheckedChange={checked => setScopeAcknowledged(checked === true)}
                              className="mt-0.5"
                            />
                            <span>I have reviewed and acknowledge the service scope for this request.</span>
                          </label>
                        </div>

                        <BookingEngineQuestionFields
                          questions={questions}
                          answers={answers}
                          onAnswerChange={(questionKey, value) =>
                            setAnswers(prev => ({
                              ...prev,
                              [questionKey]: value,
                            }))
                          }
                        />
                        {submitError ? (
                          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                            {submitError}
                          </div>
                        ) : null}

                        <div className="mt-6 flex justify-end">
                          <Button
                            type="button"
                            disabled={submitting || !scopeAcknowledged}
                            onClick={handleSubmitRequest}
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                Submit Request
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </div>

                        </>
                      )
                    )}

                </CardContent>
              </Card>
          ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.id} className="overflow-hidden">
                {service.image_url ? (
                  <img
                    src={service.image_url}
                    alt={service.name}
                    className="h-44 w-full object-cover"
                  />
                ) : null}

                <CardContent className="p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {service.category}
                  </p>

                  <h2 className="mt-1 text-lg font-semibold">{service.name}</h2>

                  {service.short_description || service.description ? (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {service.short_description || service.description}
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Starting from
                      </p>
                      <p className="font-semibold">
                        KSh {service.base_price.toLocaleString()}
                      </p>
                    </div>

                    <Button onClick={() => {
                      setSelectedService(service);
                      setStep(1);
                      setQuestions([]);
                      setScopeItems([]);
                      setScopeAcknowledged(false);
                      setRequestId(null);
                      setRequestItemId(null);
                      setAnswers({});
                      setQuestionError(null);
                    }}>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          )
                      )}
      </div>
    </div>
  );
}
