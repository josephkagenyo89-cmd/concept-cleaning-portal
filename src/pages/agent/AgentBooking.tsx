import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';
import { getTier, calculateCommission } from '@/lib/commission';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { savePending } from '@/lib/offlineDb';
import MultiServiceSelector, { LineItem } from '@/components/booking/MultiServiceSelector';
import PriceBreakdown from '@/components/booking/PriceBreakdown';
import QuotationActions from '@/components/booking/QuotationActions';
import SalespersonSelector from '@/components/booking/SalespersonSelector';
import { upsertClientForBooking } from '@/lib/clientManager';
import ClientSearchSelector, { SelectedClient } from '@/components/booking/ClientSearchSelector';

export default function AgentBooking() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(null);
  const [agentPrice, setAgentPrice] = useState('');
  const [date, setDate] = useState<Date>();
  const [cumulativeRevenue, setCumulativeRevenue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [salesperson, setSalesperson] = useState({ id: '', name: '', role: 'agent' });

  useEffect(() => {
    if (user && profile) {
      setSalesperson({ id: user.id, name: profile.full_name || 'Agent', role: 'agent' });
    }
  }, [user, profile]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('services').select('*').eq('is_active', true);
      setServices(data || []);

      if (user) {
        const { data: completed } = await supabase
          .from('bookings')
          .select('price')
          .eq('agent_id', user.id)
          .eq('status', 'completed');
        const rev = (completed || []).reduce((s: number, b: any) => s + Number(b.price), 0);
        setCumulativeRevenue(rev);
      }
    };
    load();
  }, [user]);

  const tier = getTier(cumulativeRevenue);

  // Computed prices from line items
  const systemPrice = lineItems.reduce((sum, item) => sum + item.total, 0);
  const currentAgentPrice = Number(agentPrice) || 0;
  const agentMargin = currentAgentPrice > systemPrice ? currentAgentPrice - systemPrice : 0;
  const finalPrice = currentAgentPrice >= systemPrice ? currentAgentPrice : systemPrice;
  const priceError = currentAgentPrice > 0 && currentAgentPrice < systemPrice
    ? `Price cannot be less than Ksh ${systemPrice.toLocaleString()}`
    : null;
  const commission = finalPrice > 0 && !priceError ? calculateCommission(finalPrice, tier) : null;

  const hasServices = lineItems.length > 0;
  const primaryService = lineItems[0]?.service || null;

  // Auto-update agent price when line items change
  const handleLineItemsChange = (items: LineItem[]) => {
    setLineItems(items);
    const newSystemPrice = items.reduce((sum, item) => sum + item.total, 0);
    // Auto-set if agent hasn't manually adjusted price upward
    if (!agentPrice || currentAgentPrice <= systemPrice) {
      setAgentPrice(newSystemPrice > 0 ? String(newSystemPrice) : '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !hasServices || !date || priceError || currentAgentPrice < systemPrice) return;
    setLoading(true);

    const clientId = await upsertClientForBooking({
      clientName: form.client_name,
      clientPhone: form.client_phone,
      location: form.location,
      bookingPrice: finalPrice,
      createdBy: user.id,
      createdByRole: 'agent',
    });

    const lineItemsData = lineItems.map(i => ({
      serviceName: i.service.name,
      serviceId: i.service.id,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total,
    }));

    const bookingData = {
      agent_id: user.id,
      client_name: form.client_name,
      client_phone: form.client_phone,
      location: form.location,
      service_id: primaryService.id,
      service_date: format(date, 'yyyy-MM-dd'),
      price: finalPrice,
      system_price: systemPrice,
      agent_price: finalPrice,
      agent_margin: agentMargin,
      quantity: String(lineItems.length),
      created_by_name: profile?.full_name || 'Agent',
      created_by_role: 'agent',
      salesperson_id: salesperson.id || user.id,
      salesperson_name: salesperson.name || profile?.full_name || 'Agent',
      salesperson_role: salesperson.role || 'agent',
      line_items: lineItemsData,
      ...(clientId ? { client_id: clientId } : {}),
    };

    if (!navigator.onLine) {
      await savePending({
        localId: crypto.randomUUID(),
        type: 'booking',
        data: bookingData,
        createdAt: new Date().toISOString(),
        synced: false,
      });
      setLoading(false);
      toast({ title: 'Saved offline', description: 'Booking will sync when you reconnect.' });
      navigate('/agent');
      return;
    }

    const { data: inserted, error } = await supabase.from('bookings').insert(bookingData).select('id').single();
    setLoading(false);
    if (error) {
      toast({ title: 'Booking failed', description: error.message, variant: 'destructive' });
    } else {
      // Auto-generate quotation document in background
      try {
        const { autoCreateQuotationForBooking } = await import('@/lib/autoDocuments');
        await autoCreateQuotationForBooking({
          clientName: form.client_name,
          clientPhone: form.client_phone,
          clientLocation: form.location,
          lineItems: lineItems.map(i => ({ name: i.service.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
          totalAmount: finalPrice,
          serviceDate: date,
          createdById: user.id,
          createdBy: profile?.full_name || 'Agent',
          createdByRole: 'agent',
          bookingId: (inserted as any)?.id,
          clientId: clientId || undefined,
          salespersonName: salesperson.name || profile?.full_name || 'Agent',
        });
      } catch (e) { console.warn('Auto-quotation failed', e); }
      toast({ title: 'Booking created!', description: `Quotation auto-saved. ${lineItems.length} service${lineItems.length > 1 ? 's' : ''} booked.` });
      navigate('/agent');
    }
  };

  // Quotation line items format
  const quotationLineItems = lineItems.map(i => ({
    name: i.service.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: i.total,
  }));

  const canQuote = hasServices && form.client_name && form.client_phone && systemPrice > 0
    && currentAgentPrice >= systemPrice && !priceError;

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-6">
      <h1 className="text-2xl font-bold mb-4">New Booking</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Services */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Services</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiServiceSelector
              services={services}
              lineItems={lineItems}
              onChange={handleLineItemsChange}
            />
          </CardContent>
        </Card>

        {/* Salesperson */}
        <Card>
          <CardContent className="pt-4">
            <SalespersonSelector value={salesperson} onChange={setSalesperson} />
          </CardContent>
        </Card>

        {/* Client Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Client Name</Label>
              <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} required placeholder="Jane Wanjiku" />
            </div>
            <div className="space-y-1.5">
              <Label>Client Phone</Label>
              <Input value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} required placeholder="0712345678" />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required placeholder="Kilimani, Nairobi" />
            </div>
          </CardContent>
        </Card>

        {/* Service Date & Pricing */}
        {hasServices && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Date & Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Service Date */}
              <div className="space-y-1.5">
                <Label>Service Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={date} onSelect={setDate} disabled={d => d < new Date()} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Agent Price (editable) */}
              {systemPrice > 0 && (
                <div className="space-y-1.5">
                  <Label>Your Price (Ksh)</Label>
                  <Input
                    type="number"
                    value={agentPrice}
                    onChange={e => setAgentPrice(e.target.value)}
                    min={systemPrice}
                    required
                    placeholder={`Min: ${systemPrice.toLocaleString()}`}
                  />
                  {priceError && <p className="text-xs text-destructive">{priceError}</p>}
                  <p className="text-xs text-muted-foreground">
                    You can increase the price but not below Ksh {systemPrice.toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Price Breakdown & Commission Preview */}
        {systemPrice > 0 && currentAgentPrice >= systemPrice && !priceError && (
          <PriceBreakdown
            serviceName={lineItems.length === 1 ? lineItems[0].service.name : `${lineItems.length} Services`}
            systemPrice={systemPrice}
            agentPrice={finalPrice}
            agentMargin={agentMargin}
            tier={tier}
            commission={commission}
            lineItems={lineItems.length > 1 ? lineItems.map(i => ({ name: i.service.name, unitPrice: i.unitPrice })) : undefined}
          />
        )}

        {/* Quotation actions */}
        {canQuote && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-2">Generate Quotation</p>
              <QuotationActions
                clientName={form.client_name}
                clientPhone={form.client_phone}
                serviceName={lineItems.map(i => i.service.name).join(', ')}
                serviceDate={date}
                price={finalPrice}
                userId={user?.id || ''}
                userName={profile?.full_name || 'Agent'}
                userRole="agent"
                lineItems={quotationLineItems}
                salespersonId={salesperson.id}
                salespersonName={salesperson.name}
                salespersonRole={salesperson.role}
              />
            </CardContent>
          </Card>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !hasServices || !date || !!priceError || systemPrice <= 0 || currentAgentPrice < systemPrice}
        >
          {loading ? 'Creating...' : `Create Booking${lineItems.length > 1 ? ` (${lineItems.length} services)` : ''}`}
        </Button>
      </form>
    </div>
  );
}
