import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';
import { getTier, calculateCommission } from '@/lib/commission';
import TierBadge from '@/components/agent/TierBadge';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { savePending } from '@/lib/offlineDb';

export default function AgentBooking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [form, setForm] = useState({
    client_name: '', client_phone: '', location: '', price: '', size_sqm: '',
  });
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
  const requiresSize = selectedService?.requires_size_input === true;
  const pricePerSqm = Number(selectedService?.price_per_sqm) || 0;
  const sizeSqm = Number(form.size_sqm) || 0;

  // Auto-calculate price for size-based services
  const calculatedPrice = requiresSize && pricePerSqm > 0 && sizeSqm > 0 ? sizeSqm * pricePerSqm : 0;
  const price = requiresSize && pricePerSqm > 0 ? calculatedPrice : (Number(form.price) || 0);
  const commission = price > 0 ? calculateCommission(price, tier) : null;
  const basePrice = selectedService ? Number(selectedService.base_price) : 0;
  const priceError = price > 0 && price < basePrice ? `Minimum price is Ksh ${basePrice.toLocaleString()}` : null;

  const handleServiceChange = (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    setSelectedService(svc);
    if (svc) {
      setForm(f => ({
        ...f,
        price: svc.requires_size_input && Number(svc.price_per_sqm) > 0 ? '' : String(svc.base_price),
        size_sqm: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedService || !date || priceError || (requiresSize && sizeSqm <= 0)) return;
    setLoading(true);

    const bookingData = {
      agent_id: user.id,
      client_name: form.client_name,
      client_phone: form.client_phone,
      location: form.location,
      service_id: selectedService.id,
      service_date: format(date, 'yyyy-MM-dd'),
      price: requiresSize && pricePerSqm > 0 ? calculatedPrice : Number(form.price),
      size_sqm: requiresSize ? sizeSqm : null,
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

  return (
    <div className="max-w-lg mx-auto pb-20 md:pb-6">
      <h1 className="text-2xl font-bold mb-4">New Booking</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Service & Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Service Type</Label>
              <Select onValueChange={handleServiceChange}>
                <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                <SelectContent>
                  {['Cleaning Services', 'Upholstery & Carpet Cleaning', 'Car Detailing'].map(cat => {
                    const catServices = services.filter(s => s.category === cat);
                    if (catServices.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cat}</div>
                        {catServices.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}{Number(s.base_price) > 0 ? ` — Ksh ${Number(s.base_price).toLocaleString()}` : ''}
                          </SelectItem>
                        ))}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
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
            {requiresSize && (
              <div className="space-y-1.5">
                <Label>Enter Size (Square Meters)</Label>
                <Input type="number" value={form.size_sqm} onChange={e => setForm(f => ({ ...f, size_sqm: e.target.value }))} required min={1} placeholder="e.g. 50" />
                {pricePerSqm > 0 && sizeSqm > 0 && (
                  <p className="text-sm font-medium text-primary">
                    Calculated Price: Ksh {calculatedPrice.toLocaleString()} ({sizeSqm} m² × Ksh {pricePerSqm.toLocaleString()}/m²)
                  </p>
                )}
              </div>
            )}
            {!requiresSize || pricePerSqm === 0 ? (
              <div className="space-y-1.5">
                <Label>Price (Ksh)</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required min={basePrice} />
                {priceError && <p className="text-xs text-destructive">{priceError}</p>}
                {basePrice > 0 && <p className="text-xs text-muted-foreground">Base: Ksh {basePrice.toLocaleString()}</p>}
              </div>
            ) : (
              price > 0 && (
                <div className="space-y-1.5">
                  <Label>Total Price (Ksh)</Label>
                  <Input type="number" value={calculatedPrice} disabled />
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Commission Preview */}
        {commission && !priceError && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 space-y-2">
              <CardDescription className="font-medium text-foreground">Commission Preview</CardDescription>
              <div className="flex items-center gap-2">
                <span className="text-sm">Your tier:</span>
                <TierBadge tier={tier} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Commission ({(commission.commission / price * 100).toFixed(1)}%):</span>
                <span className="font-medium">Ksh {commission.commission.toLocaleString()}</span>
                {commission.bonus > 0 && (
                  <>
                    <span className="text-muted-foreground">High-value bonus:</span>
                    <span className="font-medium text-success">+Ksh {commission.bonus.toLocaleString()}</span>
                  </>
                )}
                <span className="text-muted-foreground font-medium">Total commission:</span>
                <span className="font-bold text-primary">Ksh {commission.total.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full" disabled={loading || !selectedService || !date || !!priceError || (requiresSize && sizeSqm <= 0)}>
          {loading ? 'Creating...' : 'Create Booking'}
        </Button>
      </form>
    </div>
  );
}
