import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type RequestDetails = {
  id: string;
  request_number: string;
  customer_id: string | null;
  status: string;
  requested_date: string | null;
  requested_time: string | null;
  service_location: string | null;
  customer_notes: string | null;
  customer_acknowledged_scope: boolean;
  quotation_id: string | null;
  converted_booking_id: string | null;
  created_at: string;
  submitted_at: string | null;
  updated_at: string;
  clients: {
    full_name: string | null;
    phone: string | null;
    client_id: string | null;
  } | null;
  booking_engine_request_items: {
    id: string;
    service_id: string;
    quantity: number | null;
    measurements: Record<string, unknown>;
    answers: Record<string, unknown>;
    selected_extras: unknown[];
    pricing_snapshot: Record<string, unknown>;
    scope_snapshot: Record<string, unknown>;
    service_config_version: number | null;
    services: {
      name: string | null;
      category: string | null;
      service_code: string | null;
    } | null;
  }[];
};

type EventRow = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  message: string | null;
  actor_name: string | null;
  actor_role: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  awaiting_customer: 'Awaiting Customer',
  approved: 'Approved',
  quote_required: 'Quote Required',
  quote_prepared: 'Quote Prepared',
  customer_accepted: 'Customer Accepted',
  ready_for_booking: 'Ready for Booking',
  converted: 'Converted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function formatStatus(status: string | null) {
  if (!status) return '—';
  return statusLabels[status] || status;
}

function formatDateTime(value: string | null) {
  if (!value) return '—';

  try {
    return format(new Date(value), 'PPP p');
  } catch {
    return value;
  }
}

function formatRequestedDate(value: string | null) {
  if (!value) return 'Not specified';

  try {
    return format(new Date(`${value}T00:00:00`), 'PPP');
  } catch {
    return value;
  }
}

function formatRequestedTime(value: string | null) {
  if (!value) return 'Not specified';

  const [hours, minutes] = value.split(':');

  if (hours === undefined || minutes === undefined) {
    return value;
  }

  const hour = Number(hours);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minutes} ${suffix}`;
}

function formatJsonValue(value: unknown) {
  if (value === null || value === undefined) return '—';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminBookingEngineRequestDetails() {
  const { id } = useParams<{ id: string }>();

  const [request, setRequest] = useState<RequestDetails | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) {
      setRequest(null);
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [requestResult, eventsResult] = await Promise.all([
      supabase
        .from('booking_engine_requests')
        .select(`
          id,
          request_number,
          customer_id,
          status,
          requested_date,
          requested_time,
          service_location,
          customer_notes,
          customer_acknowledged_scope,
          quotation_id,
          converted_booking_id,
          created_at,
          submitted_at,
          updated_at,
          clients (
            full_name,
            phone,
            client_id
          ),
          booking_engine_request_items (
            id,
            service_id,
            quantity,
            measurements,
            answers,
            selected_extras,
            pricing_snapshot,
            scope_snapshot,
            service_config_version,
            services (
              name,
              category,
              service_code
            )
          )
        `)
        .eq('id', id)
        .maybeSingle(),

      supabase
        .from('booking_engine_request_events')
        .select(`
          id,
          event_type,
          from_status,
          to_status,
          message,
          actor_name,
          actor_role,
          metadata,
          created_at
        `)
        .eq('request_id', id)
        .order('created_at', { ascending: false }),
    ]);

    if (requestResult.error) {
      toast({
        title: 'Failed to load Booking Engine request',
        description: requestResult.error.message,
        variant: 'destructive',
      });
      setRequest(null);
    } else {
      setRequest(requestResult.data as unknown as RequestDetails | null);
    }

    if (eventsResult.error) {
      toast({
        title: 'Failed to load request timeline',
        description: eventsResult.error.message,
        variant: 'destructive',
      });
      setEvents([]);
    } else {
      setEvents((eventsResult.data as unknown as EventRow[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading Booking Engine request...
        </CardContent>
      </Card>
    );
  }

  if (!request) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          Booking Engine request not found.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.location.href = '/admin/booking-engine';
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div>
            <h1 className="text-2xl font-bold">{request.request_number}</h1>
            <p className="text-sm text-muted-foreground">
              Booking Engine Request
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {formatStatus(request.status)}
          </Badge>

          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">
              {request.clients?.full_name || 'Unknown customer'}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p className="font-medium">
              {request.clients?.phone || 'No phone'}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Client ID</p>
            <p className="font-medium">
              {request.clients?.client_id || request.customer_id || '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request Information</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Requested date</p>
            <p className="font-medium">
              {formatRequestedDate(request.requested_date)}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Requested time</p>
            <p className="font-medium">
              {formatRequestedTime(request.requested_time)}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Service location</p>
            <p className="font-medium">
              {request.service_location || 'Not specified'}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Scope acknowledgement</p>
            <p className="font-medium">
              {request.customer_acknowledged_scope ? 'Acknowledged' : 'Not acknowledged'}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">{formatDateTime(request.created_at)}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Submitted</p>
            <p className="font-medium">{formatDateTime(request.submitted_at)}</p>
          </div>

          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground">Customer notes</p>
            <p className="font-medium whitespace-pre-wrap">
              {request.customer_notes || 'No notes'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Services & Customer Inputs</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {request.booking_engine_request_items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No services have been added to this request.
            </p>
          ) : (
            request.booking_engine_request_items.map((item, index) => {
              const pricing = item.pricing_snapshot || {};

              return (
                <Card key={item.id}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {item.services?.name || 'Unknown service'}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {item.services?.service_code || 'No service code'}
                          {item.services?.category
                            ? ` · ${item.services.category}`
                            : ''}
                        </p>
                      </div>

                      <Badge variant="outline">
                        Item {index + 1}
                      </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Quantity</p>
                        <p className="font-medium">
                          {item.quantity ?? pricing.quantity ?? '—'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Pricing status</p>
                        <p className="font-medium">
                          {String(pricing.status || 'Not priced')}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Rate</p>
                        <p className="font-medium">
                          {pricing.rate !== undefined
                            ? `${pricing.currency || 'KES'} ${formatJsonValue(pricing.rate)}`
                            : '—'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-medium">
                          {pricing.total !== undefined
                            ? `${pricing.currency || 'KES'} ${formatJsonValue(pricing.total)}`
                            : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm font-semibold mb-1">Measurements</p>
                        <pre className="text-xs bg-muted rounded-md p-3 overflow-auto whitespace-pre-wrap">
                          {formatJsonValue(item.measurements)}
                        </pre>
                      </div>

                      <div>
                        <p className="text-sm font-semibold mb-1">Answers</p>
                        <pre className="text-xs bg-muted rounded-md p-3 overflow-auto whitespace-pre-wrap">
                          {formatJsonValue(item.answers)}
                        </pre>
                      </div>

                      <div>
                        <p className="text-sm font-semibold mb-1">Selected Extras</p>
                        <pre className="text-xs bg-muted rounded-md p-3 overflow-auto whitespace-pre-wrap">
                          {formatJsonValue(item.selected_extras)}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-semibold mb-1">Pricing Snapshot</p>
                      <pre className="text-xs bg-muted rounded-md p-3 overflow-auto whitespace-pre-wrap">
                        {formatJsonValue(pricing)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Summary</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {request.booking_engine_request_items.map((item) => {
              const pricing = item.pricing_snapshot || {};

              return (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <p className="font-medium">
                      {item.services?.name || 'Unknown service'}
                    </p>

                    <p className="text-sm text-muted-foreground">
                      {String(pricing.pricing_source || '—')}
                    </p>

                    <p className="text-lg font-semibold mt-2">
                      {pricing.total !== undefined
                        ? `${pricing.currency || 'KES'} ${formatJsonValue(pricing.total)}`
                        : 'Quotation required'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked Records</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Quotation ID</p>
            <p className="font-medium break-all">
              {request.quotation_id || 'No quotation linked'}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Converted Booking ID</p>
            <p className="font-medium break-all">
              {request.converted_booking_id || 'Not converted'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request Timeline</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No timeline events found.
            </p>
          ) : (
            events.map((event) => (
              <div
                key={event.id}
                className="border-l-2 pl-4 space-y-1"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">
                    {event.event_type}
                  </Badge>

                  {event.to_status && (
                    <Badge variant="secondary">
                      {formatStatus(event.to_status)}
                    </Badge>
                  )}
                </div>

                <p className="text-sm">
                  {event.message || 'No message'}
                </p>

                <p className="text-xs text-muted-foreground">
                  {event.actor_name || 'System'}
                  {event.actor_role ? ` · ${event.actor_role}` : ''}
                  {' · '}
                  {formatDateTime(event.created_at)}
                </p>

                {Object.keys(event.metadata || {}).length > 0 && (
                  <pre className="text-xs bg-muted rounded-md p-3 overflow-auto whitespace-pre-wrap">
                    {formatJsonValue(event.metadata)}
                  </pre>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}