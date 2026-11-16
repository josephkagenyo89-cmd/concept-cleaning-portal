import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarDays,
  MapPin,
  Star,
  Download,
} from 'lucide-react';
import FeedbackDialog from '@/components/feedback/FeedbackDialog';
import { formatKes } from '@/lib/marketplace';
import CustomerLoginPrompt from '@/components/marketplace/CustomerLoginPrompt';
import { useSettings } from '@/hooks/useSettings';
import { toast } from '@/hooks/use-toast';
import {
  downloadCustomerBooking,
  downloadCustomerQuotation,
  primePdfSettings,
} from '@/lib/customerDownloads';

export default function CustomerBookings() {
  const { user, isCustomer, customerClient } = useAuth();
  const { settings } = useSettings();

  const [params, setParams] = useSearchParams();
  const tab = ['bookings','quotations','requests'].includes(params.get('tab') || '') ? (params.get('tab') as string) : 'bookings';

  const [bookings, setBookings] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [engineRequests, setEngineRequests] = useState<any[]>([]);
  const [requestAction, setRequestAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedbackFor, setFeedbackFor] =
    useState<any | null>(null);

  useEffect(() => {
    if (!user || !isCustomer) {
      setLoading(false);
      return;
    }

    (async () => {
      const [b, q, r] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, service_time, services(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('quotations')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('booking_engine_requests').select('id,request_number,status,requested_date,requested_time,service_location,quotation_id,converted_booking_id,created_at,quotation:quotations!booking_engine_requests_quotation_id_fkey(quotation_number,price)').order('created_at',{ascending:false}),
      ]);

      setBookings(b.data || []);
      setQuotations(q.data || []);
      setEngineRequests(r.data || []);
      setLoading(false);
    })();
  }, [user, isCustomer]);

  const handleEngineRequestAction = async (request: any, action: 'accept' | 'reject' | 'confirm' = 'confirm') => {
    setRequestAction(request.id);
    try {
      if (action === 'reject') {
        const rejected = await supabase.rpc('reject_booking_engine_quotation', {
          _request_id: request.id, _reason: 'Customer declined the quotation from My Bookings.',
        } as any);
        if (rejected.error) throw rejected.error;
        setEngineRequests(rows => rows.map(row => row.id === request.id ? { ...row, status: 'rejected' } : row));
        toast({ title: 'Quotation declined', description: 'The request has been marked as rejected.' });
        return;
      }
      if (action === 'accept') {
        const accepted = await supabase.rpc('accept_booking_engine_quotation', { _request_id: request.id } as any);
        if (accepted.error) throw accepted.error;
        setEngineRequests(rows => rows.map(row => row.id === request.id ? { ...row, status: 'customer_accepted' } : row));
        toast({ title: 'Quotation accepted', description: 'You can now confirm the booking when ready.' });
        return;
      }
      if (request.status === 'customer_accepted' || request.status === 'ready_for_booking') {
        const ready = await supabase.rpc('mark_booking_engine_ready_for_booking', { _request_id: request.id } as any);
        if (ready.error) throw ready.error;
        setEngineRequests(rows => rows.map(row => row.id === request.id ? { ...row, status: 'ready_for_booking' } : row));
      }
      const converted = await supabase.rpc('convert_booking_engine_request', { _request_id: request.id } as any);
        if (converted.error) throw converted.error;
        setEngineRequests(rows => rows.map(row => row.id === request.id ? { ...row, status: 'converted', converted_booking_id: converted.data?.booking_id || row.converted_booking_id } : row));
        toast({ title: 'Booking confirmed', description: converted.data?.booking_code ? 'Booking reference: ' + converted.data.booking_code : 'Your request has been converted to a booking.' });
        const refreshed = await supabase.from('bookings').select('*, service_time, services(name)').order('created_at',{ascending:false});
        if (!refreshed.error) setBookings(refreshed.data || []);
    } catch (error: any) {
      toast({ title: 'Could not update request', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setRequestAction('');
    }
  };


  if (!isCustomer) {
    return <CustomerLoginPrompt title="Your bookings" />;
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-base font-bold">My bookings</h1>
      <p className="mb-4 text-xs text-muted-foreground">
        Requests you have made with us.
      </p>

      <Tabs
        value={tab}
        onValueChange={(v) => setParams({ tab: v })}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bookings">
            Bookings ({bookings.length})
          </TabsTrigger>
          <TabsTrigger value="quotations">
            Quotations ({quotations.length})
          </TabsTrigger>
          <TabsTrigger value="requests">Guided requests ({engineRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-3 pt-3">
          {!loading && engineRequests.length === 0 && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No guided booking requests yet.</CardContent></Card>}
          {engineRequests.map((request) => (
            <Card key={request.id}><CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="text-sm font-semibold">{request.request_number}</p><p className="text-xs text-muted-foreground">{request.requested_date || 'Date pending'} {request.requested_time || ''}</p></div>
                <Badge variant="secondary" className="capitalize">{String(request.status).replaceAll('_',' ')}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{request.service_location || 'Location not provided'}</p>
              {request.quotation?.quotation_number && <div className="flex items-center justify-between rounded bg-muted/50 p-2 text-sm"><span>Quotation {request.quotation.quotation_number}</span><b>{formatKes(Number(request.quotation.price))}</b></div>}
              {request.status === 'quote_prepared' && <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void handleEngineRequestAction(request, 'accept')} disabled={!!requestAction}>Accept quotation</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  if (window.confirm('Decline this quotation? The request will be marked as rejected.')) void handleEngineRequestAction(request, 'reject');
                }} disabled={!!requestAction}>Decline quotation</Button>
              </div>}
              {(request.status === 'customer_accepted' || request.status === 'ready_for_booking') && <Button size="sm" onClick={() => void handleEngineRequestAction(request, 'confirm')} disabled={!!requestAction}>{requestAction===request.id?'Confirming…':'Confirm booking'}</Button>}
              {request.status === 'rejected' && <p className="text-xs text-muted-foreground">This quotation was declined and the request is closed.</p>}
              {request.status === 'converted' && <p className="text-xs font-medium text-emerald-700">Converted to an ERP booking.</p>}
              {['submitted','under_review','awaiting_customer','approved','quote_required'].includes(request.status) && <p className="text-xs text-muted-foreground">Our team is reviewing this request. No appointment has been confirmed yet.</p>}
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent
          value="bookings"
          className="space-y-3 pt-3"
        >
          {loading && (
            <p className="text-sm text-muted-foreground">
              Loading…
            </p>
          )}

          {!loading && bookings.length === 0 && (
            <Card>
              <CardContent className="space-y-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  You have no bookings yet.
                </p>
                <Button
                  asChild
                  className="bg-market text-market-foreground hover:bg-market/90"
                >
                  <Link to="/">Browse services</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {bookings.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">
                      {b.services?.name || 'Service'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.booking_code || b.id.slice(0, 8)}
                    </p>
                  </div>

                  <Badge
                    variant="secondary"
                    className="capitalize"
                  >
                    {String(b.status).replace('_', ' ')}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {b.service_date}{b.service_time ? ' · ' + String(b.service_time).slice(0,5) : ''}
                  </span>

                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {b.location}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-sm font-bold text-market">
                    {formatKes(Number(b.price))}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        primePdfSettings(settings);
                        downloadCustomerBooking(b);
                      }}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Download PDF
                    </Button>

                    {b.status === 'completed' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFeedbackFor(b)}
                      >
                        <Star className="mr-1 h-3.5 w-3.5" />
                        Rate service
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent
          value="quotations"
          className="space-y-3 pt-3"
        >
          {!loading && quotations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No quotation requests yet.
            </p>
          )}

          {quotations.map((q) => (
            <Card key={q.id}>
              <CardContent className="space-y-1 p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-semibold">
                    {q.service_name}
                  </p>
                  <Badge variant="outline">
                    {q.quotation_number}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  {new Date(
                    q.created_at,
                  ).toLocaleDateString()}
                </p>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-market">
                    {formatKes(Number(q.price))}
                  </p>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      primePdfSettings(settings);
                      downloadCustomerQuotation(q);
                    }}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {feedbackFor && (
        <FeedbackDialog
          open={!!feedbackFor}
          onOpenChange={(o) =>
            !o && setFeedbackFor(null)
          }
          bookingId={feedbackFor.id}
          clientId={customerClient?.id}
          clientName={
            customerClient?.full_name ||
            feedbackFor.client_name
          }
          clientPhone={feedbackFor.client_phone}
          serviceName={feedbackFor.services?.name}
        />
      )}
    </div>
  );
}