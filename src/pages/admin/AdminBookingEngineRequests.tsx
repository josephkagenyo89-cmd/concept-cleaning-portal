import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Search, RefreshCw, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type RequestRow = {
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
  } | null;
  booking_engine_request_items: {
    id: string;
    quantity: number | null;
    services: {
      name: string | null;
      category: string | null;
    } | null;
  }[];
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

export default function AdminBookingEngineRequests() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
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
          phone
        ),
        booking_engine_request_items (
          id,
          quantity,
          services (
            name,
            category
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Failed to load Booking Engine requests',
        description: error.message,
        variant: 'destructive',
      });
      setRequests([]);
    } else {
      setRequests((data as unknown as RequestRow[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = requests.filter((request) => {
    if (!search.trim()) return true;

    const term = search.toLowerCase();

    const customerName = request.clients?.full_name?.toLowerCase() || '';
    const phone = request.clients?.phone?.toLowerCase() || '';
    const requestNumber = request.request_number.toLowerCase();

    const services = request.booking_engine_request_items
      .map((item) => item.services?.name || '')
      .join(' ')
      .toLowerCase();

    return (
      requestNumber.includes(term) ||
      customerName.includes(term) ||
      phone.includes(term) ||
      services.includes(term)
    );
  });

  const formatRequestedDate = (date: string | null) => {
    if (!date) return 'Not specified';

    try {
      return format(new Date(`${date}T00:00:00`), 'PPP');
    } catch {
      return date;
    }
  };

  const formatRequestedTime = (time: string | null) => {
    if (!time) return 'Not specified';

    const [hours, minutes] = time.split(':');
    if (hours === undefined || minutes === undefined) return time;

    const hour = Number(hours);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minutes} ${suffix}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Booking Engine Requests</h1>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.href = "/admin/booking-engine/config"}
          >
            <Settings className="h-4 w-4 mr-1" />
            Configuration
          </Button>

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

      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search request number, client, phone, service..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-8"
        />
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Loading Booking Engine requests...
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No Booking Engine requests found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold">
                      {request.clients?.full_name || 'Unknown customer'}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {request.clients?.phone || 'No phone'}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Request: {request.request_number}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Services:{' '}
                      {request.booking_engine_request_items.length > 0
                        ? request.booking_engine_request_items
                            .map((item) => item.services?.name || 'Unknown service')
                            .join(', ')
                        : 'No services'}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Requested:{' '}
                      {formatRequestedDate(request.requested_date)}
                      {request.requested_time
                        ? ` · ${formatRequestedTime(request.requested_time)}`
                        : ''}
                    </p>

                    {request.service_location && (
                      <p className="text-xs text-muted-foreground">
                        Location: {request.service_location}
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Submitted:{' '}
                      {request.submitted_at
                        ? format(new Date(request.submitted_at), 'PPP p')
                        : 'Not submitted'}
                    </p>
                  </div>

                  <div className="text-right space-y-1 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {request.request_number}
                    </Badge>

                    <div>
                      <Badge variant="secondary" className="text-xs">
                        {statusLabels[request.status] || request.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.location.href = `/admin/booking-engine/${request.id}`;
                    }}
                  >
                    View Request
                  </Button>

                  {request.quotation_id && (
                    <Badge variant="outline" className="text-xs">
                      Quotation linked
                    </Badge>
                  )}

                  {request.converted_booking_id && (
                    <Badge variant="outline" className="text-xs">
                      Booking linked
                    </Badge>
                  )}

                  {request.customer_acknowledged_scope && (
                    <Badge variant="outline" className="text-xs">
                      Scope acknowledged
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}