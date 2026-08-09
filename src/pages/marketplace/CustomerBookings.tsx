import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, MapPin, Star, Download } from 'lucide-react';
import FeedbackDialog from '@/components/feedback/FeedbackDialog';
import { formatKes } from '@/lib/marketplace';
import CustomerLoginPrompt from '@/components/marketplace/CustomerLoginPrompt';
import { useSettings } from '@/hooks/useSettings';
import { downloadCustomerQuotation, primePdfSettings } from '@/lib/customerDownloads';

export default function CustomerBookings() {
  const { user, isCustomer, customerClient } = useAuth();
  const { settings } = useSettings();

  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'quotations' ? 'quotations' : 'bookings';
  const [bookings, setBookings] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackFor, setFeedbackFor] = useState<any | null>(null);

  useEffect(() => {
    if (!user || !isCustomer) { setLoading(false); return; }
    (async () => {
      const [b, q] = await Promise.all([
        supabase.from('bookings').select('*, services(name)').order('created_at', { ascending: false }),
        supabase.from('quotations').select('*').order('created_at', { ascending: false }),
      ]);
      setBookings(b.data || []);
      setQuotations(q.data || []);
      setLoading(false);
    })();
  }, [user, isCustomer]);

  if (!isCustomer) return <CustomerLoginPrompt title="Your bookings" />;

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-base font-bold">My bookings</h1>
      <p className="mb-4 text-xs text-muted-foreground">Requests you have made with us.</p>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bookings">Bookings ({bookings.length})</TabsTrigger>
          <TabsTrigger value="quotations">Quotations ({quotations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-3 pt-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && bookings.length === 0 && (
            <Card><CardContent className="space-y-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">You have no bookings yet.</p>
              <Button asChild className="bg-market text-market-foreground hover:bg-market/90"><Link to="/">Browse services</Link></Button>
            </CardContent></Card>
          )}
          {bookings.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{b.services?.name || 'Service'}</p>
                    <p className="text-xs text-muted-foreground">{b.booking_code || b.id.slice(0, 8)}</p>
                  </div>
                  <Badge variant="secondary" className="capitalize">{String(b.status).replace('_', ' ')}</Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{b.service_date}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.location}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-bold text-market">{formatKes(Number(b.price))}</span>
                  {b.status === 'completed' && (
                    <Button size="sm" variant="outline" onClick={() => setFeedbackFor(b)}>
                      <Star className="mr-1 h-3.5 w-3.5" /> Rate service
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="quotations" className="space-y-3 pt-3">
          {!loading && quotations.length === 0 && (
            <p className="text-sm text-muted-foreground">No quotation requests yet.</p>
          )}
          {quotations.map((q) => (
            <Card key={q.id}>
              <CardContent className="space-y-1 p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-semibold">{q.service_name}</p>
                  <Badge variant="outline">{q.quotation_number}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-market">{formatKes(Number(q.price))}</p>
                  <Button size="sm" variant="outline" onClick={() => { primePdfSettings(settings); downloadCustomerQuotation(q); }}>
                    <Download className="mr-1 h-3.5 w-3.5" /> Download PDF
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
          onOpenChange={(o) => !o && setFeedbackFor(null)}
          bookingId={feedbackFor.id}
          clientId={customerClient?.id}
          clientName={customerClient?.full_name || feedbackFor.client_name}
          clientPhone={feedbackFor.client_phone}
          serviceName={feedbackFor.services?.name}
        />
      )}
    </div>
  );
}
