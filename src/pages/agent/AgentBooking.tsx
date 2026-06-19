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
import MultiServiceSelector, { LineItem } from '@/components/booking/MultiServiceSelector';
import PriceBreakdown from '@/components/booking/PriceBreakdown';
import QuotationActions from '@/components/booking/QuotationActions';
import SalespersonSelector from '@/components/booking/SalespersonSelector';
import { upsertClientForBooking } from '@/lib/clientManager';
import ClientSearchSelector, { SelectedClient } from '@/components/booking/ClientSearchSelector';
import DiscountSection, { DiscountState } from '@/components/booking/DiscountSection';
import { computeDiscount, needsApproval } from '@/lib/discounts';

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
  const [discount, setDiscount] = useState<DiscountState>({ type: '', value: 0, reason: '' });

  useEffect(() => {
    if (user && profile) {
      setSalesperson((s) => s.id ? s : { id: user.id, name: profile.full_name || 'Agent', role: 'agent' });
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
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const { discountAmount, finalTotal: discountedTotal } = computeDiscount(subtotal, discount.type, discount.value);
  const hasDiscount = !!discount.type && discountAmount > 0;
  const requiresApproval = hasDiscount && needsApproval('agent');
  // While agent's discount is pending approval, the minimum price is the full subtotal.
  const systemPrice = requiresApproval ? subtotal : discountedTotal;
  const currentAgentPrice = Number(agentPrice) || 0;
  const agentMargin = currentAgentPrice > systemPrice ? currentAgentPrice - systemPrice : 0;
  const finalPrice = currentAgentPrice >= systemPrice ? currentAgentPrice : systemPrice;
  const priceError = currentAgentPrice > 0 && currentAgentPrice < systemPrice
    ? `Price cannot be less than Ksh ${systemPrice.toLocaleString()}`
    : null;
  const discountReasonMissing = !!discount.type && discount.value > 0 && !discount.reason.trim();
  const commission = finalPrice > 0 && !priceError ? calculateCommission(finalPrice, tier) : null;

  const hasServices = lineItems.length > 0;
  const primaryService = lineItems[0]?.service || null;

  const handleLineItemsChange = (items: LineItem[]) => {
    setLineItems(items);
    const newSystemPrice = items.reduce((sum, item) => sum + item.total, 0);
    if (!agentPrice || currentAgentPrice <= systemPrice) {
      setAgentPrice(newSystemPrice > 0 ? String(newSystemPrice) : '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !hasServices || !date || priceError || currentAgentPrice < systemPrice) return;
    if (!selectedClient) {
      toast({ title: 'Select a client', description: 'Search the CRM and select a client first.', variant: 'destructive' });
      return;
    }
    if (discountReasonMissing) {
      toast({ title: 'Discount reason required', variant: 'destructive' });
      return;
    }
    setLoading(true);

    await upsertClientForBooking({
      clientName: selectedClient.full_name,
      clientPhone: selectedClient.phone,
      location: selectedClient.location || '',
      bookingPrice: finalPrice,
      createdBy: user.id,
      createdByRole: 'agent',
    });

    const hasDiscount = !!discount.type && discountAmount > 0;
    const approvalStatus = hasDiscount
      ? (needsApproval('agent') ? 'pending' : 'approved')
      : 'not_required';

    const payload: any = {
      agent_id: user.id,
      client_id: selectedClient.id,
      client_name: selectedClient.full_name,
      client_phone: selectedClient.phone,
      location: selectedClient.location || '',
      service_id: primaryService?.id || null,
      service_date: format(date, 'yyyy-MM-dd'),
      price: finalPrice,
      system_price: subtotal,
      agent_price: finalPrice,
      agent_margin: agentMargin,
      subtotal,
      discount_type: hasDiscount ? discount.type : null,
      discount_value: hasDiscount ? discount.value : 0,
      discount_amount: discountAmount,
      discount_reason: hasDiscount ? discount.reason : null,
      discount_approval_status: approvalStatus,
      quantity: String(lineItems.length),
      status: 'pending',
      created_by_name: profile?.full_name || 'Agent',
      created_by_role: 'agent',
      salesperson_id: salesperson.id || user.id,
      salesperson_name: salesperson.name || profile?.full_name || 'Agent',
      salesperson_role: salesperson.role || 'agent',
      line_items: lineItems.map((i) => ({
        serviceName: i.service.name,
        serviceId: i.service.id,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.total,
      })),
    };

    const { data: inserted, error } = await supabase.from('bookings').insert(payload).select('id').single();
    setLoading(false);
    if (error) {
      toast({ title: 'Failed to save booking', description: error.message, variant: 'destructive' });
      return;
    }

    try {
      const { autoCreateQuotationForBooking } = await import('@/lib/autoDocuments');
      await autoCreateQuotationForBooking({
        clientName: selectedClient.full_name,
        clientPhone: selectedClient.phone,
        clientLocation: selectedClient.location || '',
        lineItems: lineItems.map(i => ({ name: i.service.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
        totalAmount: finalPrice,
        subtotal,
        discountAmount,
        discountReason: hasDiscount ? discount.reason : undefined,
        serviceDate: date,
        createdById: user.id,
        createdBy: profile?.full_name || 'Agent',
        createdByRole: 'agent',
        bookingId: inserted?.id,
        clientId: selectedClient.id,
        salespersonName: salesperson.name || profile?.full_name || 'Agent',
      });
    } catch (e) { console.warn('Auto-quotation failed', e); }

    const note = hasDiscount && approvalStatus === 'pending'
      ? 'Discount pending admin approval.'
      : 'Booking moved to Pending. Quotation saved.';
    toast({ title: 'Booking saved', description: note });
    navigate('/agent');
  };


  const quotationLineItems = lineItems.map(i => ({
    name: i.service.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: i.total,
  }));

  const canQuote = hasServices && !!selectedClient && systemPrice > 0
    && currentAgentPrice >= systemPrice && !priceError;

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-6">
      <h1 className="text-2xl font-bold mb-3">New Booking</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Services</CardTitle></CardHeader>
          <CardContent>
            <MultiServiceSelector services={services} lineItems={lineItems} onChange={handleLineItemsChange} />
          </CardContent>
        </Card>

        {hasServices && (
          <DiscountSection subtotal={subtotal} value={discount} onChange={setDiscount} />
        )}


        <Card>
          <CardContent className="pt-4">
            <SalespersonSelector value={salesperson} onChange={setSalesperson} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Client</CardTitle></CardHeader>
          <CardContent>
            <ClientSearchSelector value={selectedClient} onChange={setSelectedClient} />
          </CardContent>
        </Card>

        {hasServices && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Date & Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
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

        {canQuote && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-2">Generate Quotation</p>
              <QuotationActions
                clientName={selectedClient?.full_name || ''}
                clientPhone={selectedClient?.phone || ''}
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
          disabled={loading || !hasServices || !date || !selectedClient || !!priceError || systemPrice <= 0 || currentAgentPrice < systemPrice || discountReasonMissing}
        >
          {loading ? 'Saving…' : `Save Booking${lineItems.length > 1 ? ` (${lineItems.length} services)` : ''}`}
        </Button>

      </form>
    </div>
  );
}
