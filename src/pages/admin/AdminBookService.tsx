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
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ServiceSearch from '@/components/booking/ServiceSearch';
import PriceBreakdown from '@/components/booking/PriceBreakdown';
import QuotationActions from '@/components/booking/QuotationActions';
import { getTier, calculateCommission } from '@/lib/commission';
import { upsertClientForBooking } from '@/lib/clientManager';

export default function AdminBookService() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [form, setForm] = useState({ client_name: '', client_phone: '', location: '' });
  const [agentPrice, setAgentPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState<Date>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('services').select('*').eq('is_active', true).then(({ data }) => setServices(data || []));
  }, []);

  const unitPrice = selectedService ? Number(selectedService.base_price) || 0 : 0;
  const systemPrice = unitPrice * quantity;
  const currentAgentPrice = Number(agentPrice) || 0;
  const agentMargin = currentAgentPrice > systemPrice ? currentAgentPrice - systemPrice : 0;
  const finalPrice = currentAgentPrice >= systemPrice ? currentAgentPrice : systemPrice;
  const priceError = currentAgentPrice > 0 && currentAgentPrice < systemPrice
    ? `Price cannot be less than Ksh ${systemPrice.toLocaleString()}` : null;
  const tier = getTier(0); // Admin bookings don't use agent tier
  const commission = null; // No commission for admin bookings

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setQuantity(1);
    setAgentPrice(service ? String(Number(service.base_price) || 0) : '');
  };

  const handleQuantityChange = (newQty: number) => {
    const q = Math.max(1, newQty);
    setQuantity(q);
    const newSystemPrice = unitPrice * q;
    if (currentAgentPrice <= unitPrice * quantity) setAgentPrice(String(newSystemPrice));
  };

  const canQuote = selectedService && form.client_name && form.client_phone && currentAgentPrice >= systemPrice && systemPrice > 0 && !priceError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedService || !date || priceError || currentAgentPrice < systemPrice) return;
    setLoading(true);

    const { error } = await supabase.from('bookings').insert({
      agent_id: user.id,
      client_name: form.client_name,
      client_phone: form.client_phone,
      location: form.location,
      service_id: selectedService.id,
      service_date: format(date, 'yyyy-MM-dd'),
      price: finalPrice,
      system_price: systemPrice,
      agent_price: finalPrice,
      agent_margin: agentMargin,
      quantity: String(quantity),
      created_by_name: profile?.full_name || 'Admin',
      created_by_role: 'admin',
    } as any);
    setLoading(false);
    if (error) {
      toast({ title: 'Booking failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Booking created!', description: 'Admin booking — no commission generated.' });
      navigate('/admin/bookings');
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Book Service (Admin)</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Select Service</CardTitle></CardHeader>
          <CardContent>
            <ServiceSearch services={services} selectedService={selectedService} onSelect={handleServiceSelect} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Client Details</CardTitle></CardHeader>
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

        {selectedService && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Service Details & Pricing</CardTitle></CardHeader>
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

              {unitPrice > 0 && (
                <div className="space-y-1.5">
                  <Label>Quantity</Label>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => handleQuantityChange(quantity - 1)} disabled={quantity <= 1}>
                      <span className="text-lg">−</span>
                    </Button>
                    <Input type="number" value={quantity} onChange={e => handleQuantityChange(Number(e.target.value) || 1)} min={1} className="text-center w-20" />
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => handleQuantityChange(quantity + 1)}>
                      <span className="text-lg">+</span>
                    </Button>
                  </div>
                </div>
              )}

              {systemPrice > 0 && (
                <>
                  <div className="space-y-1.5">
                    <Label>System Price (Ksh)</Label>
                    <Input type="number" value={systemPrice} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Your Price (Ksh)</Label>
                    <Input type="number" value={agentPrice} onChange={e => setAgentPrice(e.target.value)} min={systemPrice} required placeholder={`Min: ${systemPrice.toLocaleString()}`} />
                    {priceError && <p className="text-xs text-destructive">{priceError}</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {systemPrice > 0 && currentAgentPrice >= systemPrice && !priceError && (
          <PriceBreakdown
            serviceName={selectedService?.name || ''}
            systemPrice={systemPrice}
            agentPrice={finalPrice}
            agentMargin={agentMargin}
            tier={tier}
            commission={commission}
            quantity={quantity}
            unitPrice={unitPrice}
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
                serviceName={selectedService?.name || ''}
                serviceDate={date}
                price={finalPrice}
                userId={user?.id || ''}
                userName={profile?.full_name || 'Admin'}
                userRole="admin"
                disabled={!canQuote}
              />
            </CardContent>
          </Card>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !selectedService || !date || !!priceError || systemPrice <= 0 || currentAgentPrice < systemPrice}
        >
          {loading ? 'Creating...' : 'Create Booking'}
        </Button>
      </form>
    </div>
  );
}
