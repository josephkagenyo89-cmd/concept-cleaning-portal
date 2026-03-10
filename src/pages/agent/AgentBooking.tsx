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
import ServiceSearch from '@/components/booking/ServiceSearch';
import DynamicServiceInput from '@/components/booking/DynamicServiceInput';
import PriceBreakdown from '@/components/booking/PriceBreakdown';

export default function AgentBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [form, setForm] = useState({
    client_name: '', client_phone: '', location: '',
  });
  const [quantity, setQuantity] = useState('');
  const [agentPrice, setAgentPrice] = useState('');
  const [date, setDate] = useState<Date>();
  const [cumulativeRevenue, setCumulativeRevenue] = useState(0);
  const [loading, setLoading] = useState(false);

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

  // Calculate system price based on service config
  const getSystemPrice = (): number => {
    if (!selectedService) return 0;
    const basePrice = Number(selectedService.base_price) || 0;
    const inputType = selectedService.input_type || 'number';
    const pricingUnit = selectedService.pricing_unit || 'fixed';

    if (inputType === 'dropdown') {
      // For dropdown services, base_price is the price for the selected option
      // or use price_per_sqm as multiplier if set
      return basePrice;
    }

    if (pricingUnit === 'per_sqft' || pricingUnit === 'per_sqm' || pricingUnit === 'per_unit') {
      const qty = Number(quantity) || 0;
      const rate = Number(selectedService.price_per_sqm) || basePrice;
      return qty > 0 ? qty * rate : 0;
    }

    return basePrice;
  };

  const systemPrice = getSystemPrice();
  const currentAgentPrice = Number(agentPrice) || 0;
  const agentMargin = currentAgentPrice > systemPrice ? currentAgentPrice - systemPrice : 0;
  const finalPrice = currentAgentPrice >= systemPrice ? currentAgentPrice : systemPrice;
  const priceError = currentAgentPrice > 0 && currentAgentPrice < systemPrice 
    ? `Price cannot be less than Ksh ${systemPrice.toLocaleString()}` 
    : null;
  const commission = finalPrice > 0 && !priceError ? calculateCommission(finalPrice, tier) : null;

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setQuantity('');
    setAgentPrice('');
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    // Auto-set agent price to system price when quantity changes
    const svc = selectedService;
    if (!svc) return;
    const inputType = svc.input_type || 'number';
    const pricingUnit = svc.pricing_unit || 'fixed';

    if (inputType === 'dropdown') {
      setAgentPrice(String(Number(svc.base_price) || 0));
    } else if (pricingUnit === 'per_sqft' || pricingUnit === 'per_sqm' || pricingUnit === 'per_unit') {
      const qty = Number(val) || 0;
      const rate = Number(svc.price_per_sqm) || Number(svc.base_price);
      if (qty > 0) setAgentPrice(String(qty * rate));
    } else {
      setAgentPrice(String(Number(svc.base_price) || 0));
    }
  };

  const isQuantityValid = () => {
    if (!selectedService) return false;
    const inputType = selectedService.input_type || 'number';
    if (inputType === 'dropdown') return quantity !== '';
    return Number(quantity) > 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedService || !date || priceError || !isQuantityValid()) return;
    setLoading(true);

    const bookingData = {
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
      quantity: quantity,
      size_sqm: selectedService.pricing_unit === 'per_sqm' ? Number(quantity) : null,
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

    const { error } = await supabase.from('bookings').insert(bookingData);
    setLoading(false);
    if (error) {
      toast({ title: 'Booking failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Booking created!', description: 'Your booking is pending confirmation.' });
      navigate('/agent');
    }
  };

  const dropdownOptions = (() => {
    try {
      const opts = selectedService?.dropdown_options;
      if (Array.isArray(opts)) return opts.map(String);
      if (typeof opts === 'string') return JSON.parse(opts);
      return [];
    } catch { return []; }
  })();

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-6">
      <h1 className="text-2xl font-bold mb-4">New Booking</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Service Search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Select Service</CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceSearch
              services={services}
              selectedService={selectedService}
              onSelect={handleServiceSelect}
            />
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

        {/* Service Configuration & Pricing */}
        {selectedService && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Service Details & Pricing</CardTitle>
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

              {/* Dynamic Input */}
              <DynamicServiceInput
                inputType={selectedService.input_type || 'number'}
                dropdownOptions={dropdownOptions}
                pricingUnit={selectedService.pricing_unit || 'fixed'}
                value={quantity}
                onChange={handleQuantityChange}
              />

              {/* System Price (read-only) */}
              {systemPrice > 0 && (
                <div className="space-y-1.5">
                  <Label>System Price (Ksh)</Label>
                  <Input type="number" value={systemPrice} disabled className="bg-muted" />
                </div>
              )}

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
                  <p className="text-xs text-muted-foreground">You can increase the price but not below Ksh {systemPrice.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Price Breakdown & Commission Preview */}
        {systemPrice > 0 && currentAgentPrice >= systemPrice && !priceError && (
          <PriceBreakdown
            serviceName={selectedService?.name || ''}
            quantity={quantity}
            systemPrice={systemPrice}
            agentPrice={finalPrice}
            agentMargin={agentMargin}
            tier={tier}
            commission={commission}
          />
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !selectedService || !date || !!priceError || !isQuantityValid() || currentAgentPrice < systemPrice}
        >
          {loading ? 'Creating...' : 'Create Booking'}
        </Button>
      </form>
    </div>
  );
}
