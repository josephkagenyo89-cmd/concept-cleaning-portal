import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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

const db = supabase as any;

export default function CustomerBookings() {
  const { user, isCustomer, customerClient } = useAuth();
  const { settings } = useSettings();

  const [params, setParams] = useSearchParams();
  const tab = ['bookings','quotations','requests'].includes(params.get('tab') || '') ? (params.get('tab') as string) : 'bookings';

  const [bookings, setBookings] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [engineRequests, setEngineRequests] = useState<any[]>([]);
  const [engineRequestItems, setEngineRequestItems] = useState<Record<string, any[]>>({});
  const [engineRequestOffers, setEngineRequestOffers] = useState<Record<string, any>>({});
  const [requestAction, setRequestAction] = useState('');
  const [requestEvents, setRequestEvents] = useState<Record<string, any[]>>({});
  const [clarificationReplies, setClarificationReplies] = useState<Record<string, string>>({});
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
      const requestRows = r.data || [];
      setEngineRequests(requestRows);
      const requestIds = requestRows.map((row: any) => row.id);
      if (requestIds.length) {
        const [history, itemResult, offerResult] = await Promise.all([
          supabase.from('booking_engine_request_events').select('id,request_id,event_type,from_status,to_status,message,actor_name,created_at').in('request_id', requestIds).order('created_at', { ascending: false }),
          db.from('booking_engine_request_items').select('id,request_id,service_id,quantity,pricing_snapshot,scope_snapshot,service:services(name)').in('request_id', requestIds).order('display_order'),
          db.from('booking_engine_request_offers').select('request_id,offer_snapshot').in('request_id', requestIds),
        ]);
        if (itemResult.error || offerResult.error) toast({ title: 'Could not load request service details', description: itemResult.error?.message || offerResult.error?.message, variant: 'destructive' });
        const itemGroups: Record<string, any[]> = {};
        (itemResult.data || []).forEach((item: any) => { (itemGroups[item.request_id] ||= []).push(item); });
        setEngineRequestItems(itemGroups);
        const offerGroups: Record<string, any> = {};
        (offerResult.data || []).forEach((row: any) => { offerGroups[row.request_id] = row.offer_snapshot; });
        setEngineRequestOffers(offerGroups);
        if (history.error) toast({ title: 'Could not load request history', description: history.error.message, variant: 'destructive' });
        const grouped: Record<string, any[]> = {};
        (history.data || []).forEach((event: any) => { (grouped[event.request_id] ||= []).push(event); });
        setRequestEvents(grouped);
      } else { setRequestEvents({}); setEngineRequestItems({}); setEngineRequestOffers({}); }
      setLoading(false);
    })();
  }, [user, isCustomer]);

  const refreshRequestHistory = async (requestId: string) => {
    const history = await supabase.from('booking_engine_request_events').select('id,request_id,event_type,from_status,to_status,message,actor_name,created_at').eq('request_id', requestId).order('created_at', { ascending: false });
    if (!history.error) setRequestEvents(rows => ({ ...rows, [requestId]: history.data || [] }));
  };

  const handleEngineRequestAction = async (request: any, action: 'accept' | 'reject' | 'confirm' | 'cancel' = 'confirm') => {
    setRequestAction(request.id);
    try {
      if (action === 'cancel') {
        const cancelled = await supabase.rpc('cancel_booking_engine_request', { _request_id: request.id, _reason: 'Customer cancelled from My Bookings.' } as any);
        if (cancelled.error) throw cancelled.error;
        setEngineRequests(rows => rows.map(row => row.id === request.id ? { ...row, status: 'cancelled' } : row));
        await refreshRequestHistory(request.id);
        toast({ title: 'Request cancelled', description: 'The request has been cancelled.' });
        return;
      }
      if (action === 'reject') {
        const rejected = await supabase.rpc('reject_booking_engine_quotation', {
          _request_id: request.id, _reason: 'Customer declined the quotation from My Bookings.',
        } as any);
        if (rejected.error) throw rejected.error;
        setEngineRequests(rows => rows.map(row => row.id === request.id ? { ...row, status: 'rejected' } : row));
        await refreshRequestHistory(request.id);
        toast({ title: 'Quotation declined', description: 'The request has been marked as rejected.' });
        return;
      }
      if (action === 'accept') {
        const accepted = await supabase.rpc('accept_booking_engine_quotation', { _request_id: request.id } as any);
        if (accepted.error) throw accepted.error;
        setEngineRequests(rows => rows.map(row => row.id === request.id ? { ...row, status: 'customer_accepted' } : row));
        await refreshRequestHistory(request.id);
        toast({ title: 'Quotation accepted', description: 'You can now confirm the booking when ready.' });
        return;
      }
      // Customer acceptance still needs the ready transition; an already-ready
      // staff-approved request must go straight to conversion.
      if (request.status === 'customer_accepted') {
        const ready = await supabase.rpc('mark_booking_engine_ready_for_booking', { _request_id: request.id } as any);
        if (ready.error) throw ready.error;
        setEngineRequests(rows => rows.map(row => row.id === request.id ? { ...row, status: 'ready_for_booking' } : row));
      }
      const converted = await supabase.rpc('convert_booking_engine_request', { _request_id: request.id } as any);
        if (converted.error) throw converted.error;
        setEngineRequests(rows => rows.map(row => row.id === request.id ? { ...row, status: 'converted', converted_booking_id: converted.data?.booking_id || row.converted_booking_id } : row));
        await refreshRequestHistory(request.id);
        toast({ title: 'Booking confirmed', description: converted.data?.booking_code ? 'Booking reference: ' + converted.data.booking_code : 'Your request has been converted to a booking.' });
        const refreshed = await supabase.from('bookings').select('*, service_time, services(name)').order('created_at',{ascending:false});
        if (!refreshed.error) setBookings(refreshed.data || []);
    } catch (error: any) {
      toast({ title: 'Could not update request', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setRequestAction('');
    }
  };

  const sendClarificationResponse = async (request: any) => {
    const response = (clarificationReplies[request.id] || '').trim();
    if (!response) { toast({ title: 'Enter your response first', variant: 'destructive' }); return; }
    setRequestAction(request.id);
    try {
      const result = await supabase.rpc('respond_booking_engine_clarification', { _request_id: request.id, _response: response } as any);
      if (result.error) throw result.error;
      setEngineRequests(rows => rows.map(row => row.id === request.id ? { ...row, status: 'under_review' } : row));
      setClarificationReplies(rows => ({ ...rows, [request.id]: '' }));
      const history = await supabase.from('booking_engine_request_events').select('id,request_id,event_type,from_status,to_status,message,actor_name,created_at').eq('request_id', request.id).order('created_at', { ascending: false });
      if (!history.error) setRequestEvents(rows => ({ ...rows, [request.id]: history.data || [] }));
      toast({ title: 'Response sent', description: 'Our team will continue reviewing your request.' });
    } catch (error: any) {
      toast({ title: 'Could not send response', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally { setRequestAction(''); }
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
              {engineRequestOffers[request.id]?.title && <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs font-semibold">Selected package / offer</p><p className="mt-1 text-sm font-medium">{engineRequestOffers[request.id].title}</p>{engineRequestOffers[request.id].description && <p className="mt-1 text-xs text-muted-foreground">{engineRequestOffers[request.id].description}</p>}{engineRequestOffers[request.id].offer_type==='package'&&Array.isArray(engineRequestOffers[request.id].package_items)&&<div className="mt-2 space-y-1">{engineRequestOffers[request.id].package_items.map((item:any)=><p key={item.id} className="text-xs text-muted-foreground">{item.name} · {item.size_label} · Qty {item.quantity}{item.complimentary?' · Complimentary':''}</p>)}</div>}{engineRequestOffers[request.id].offer_type!=='package'&&Array.isArray(engineRequestOffers[request.id].included_services)&&engineRequestOffers[request.id].included_services.length>0&&<p className="mt-1 text-xs text-muted-foreground">Includes: {engineRequestOffers[request.id].included_services.map((item:any)=>item.name).filter(Boolean).join(', ')}</p>}</div>}
              {engineRequestItems[request.id]?.length > 0 && <div className="space-y-1 rounded-lg border p-3"><p className="text-xs font-semibold">Requested services</p>{engineRequestItems[request.id].map((item:any)=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{item.service?.name || 'Service'} · Qty {item.quantity ?? 1}</span>{item.pricing_snapshot?.total != null && <b>{formatKes(Number(item.pricing_snapshot.total))}</b>}</div>)}</div>}
              {request.quotation?.quotation_number && <div className="flex items-center justify-between rounded bg-muted/50 p-2 text-sm"><span>Quotation {request.quotation.quotation_number}</span><b>{formatKes(Number(request.quotation.price))}</b></div>}
              {request.status === 'quote_prepared' && <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void handleEngineRequestAction(request, 'accept')} disabled={!!requestAction}>Accept quotation</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  if (window.confirm('Decline this quotation? The request will be marked as rejected.')) void handleEngineRequestAction(request, 'reject');
                }} disabled={!!requestAction}>Decline quotation</Button>
              </div>}
              {(request.status === 'customer_accepted' || request.status === 'ready_for_booking') && <Button size="sm" onClick={() => void handleEngineRequestAction(request, 'confirm')} disabled={!!requestAction}>{requestAction===request.id?'Confirming…':'Confirm booking'}</Button>}
              {request.status === 'awaiting_customer' && <div className="space-y-2 rounded-lg border p-3"><p className="text-sm font-medium">Our team needs more information</p><Textarea rows={3} maxLength={3000} value={clarificationReplies[request.id] || ''} onChange={e => setClarificationReplies(rows => ({ ...rows, [request.id]: e.target.value }))} placeholder="Type your response…"/><Button size="sm" onClick={() => void sendClarificationResponse(request)} disabled={!!requestAction || !(clarificationReplies[request.id] || '').trim()}>{requestAction===request.id?'Sending…':'Send response'}</Button></div>}
              {requestEvents[request.id]?.length > 0 && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-semibold">Request activity ({requestEvents[request.id].length})</summary><ol className="mt-3 space-y-2">{requestEvents[request.id].map((event:any)=><li key={event.id} className="border-l-2 pl-3"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-medium capitalize">{String(event.event_type).replaceAll('_',' ')}</span><span className="text-[11px] text-muted-foreground">{new Date(event.created_at).toLocaleString()}</span></div>{event.message&&<p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{event.message}</p>}</li>)}</ol></details>}
              {['submitted','under_review','awaiting_customer','approved','quote_required','quote_prepared','customer_accepted','ready_for_booking'].includes(request.status) && <Button size="sm" variant="outline" onClick={() => { if (window.confirm('Cancel this guided booking request?')) void handleEngineRequestAction(request, 'cancel'); }} disabled={!!requestAction}>Cancel request</Button>}
              {request.status === 'cancelled' && <p className="text-xs text-muted-foreground">This request has been cancelled.</p>}
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