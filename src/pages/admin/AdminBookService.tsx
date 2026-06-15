import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
import MultiServiceSelector, { LineItem } from '@/components/booking/MultiServiceSelector';
import PriceBreakdown from '@/components/booking/PriceBreakdown';
import QuotationActions from '@/components/booking/QuotationActions';
import SalespersonSelector from '@/components/booking/SalespersonSelector';
import { getTier } from '@/lib/commission';
import { upsertClientForBooking } from '@/lib/clientManager';
import ClientSearchSelector, { SelectedClient } from '@/components/booking/ClientSearchSelector';
import DraftStatusBadge from '@/components/booking/DraftStatusBadge';
import { createDraftBooking, patchDraft, loadBookingDraft, computeCompletionPercent, DraftRef } from '@/lib/bookingDrafts';
import { useAutoSaveDraft } from '@/hooks/useAutoSaveDraft';

export default function AdminBookService() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draftId');

  const [services, setServices] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(null);
  const [agentPrice, setAgentPrice] = useState('');
  const [date, setDate] = useState<Date>();
  const [loading, setLoading] = useState(false);
  const [salesperson, setSalesperson] = useState({ id: '', name: '', role: 'admin' });

  const [draftRef, setDraftRef] = useState<DraftRef | null>(null);
  const [bookingCode, setBookingCode] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<string>('draft');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (user && profile) {
      setSalesperson((s) => s.id ? s : { id: user.id, name: profile.full_name || 'Admin', role: 'admin' });
    }
  }, [user, profile]);

  useEffect(() => {
    supabase.from('services').select('*').eq('is_active', true).then(({ data }) => setServices(data || []));
  }, []);

  useEffect(() => {
    if (!user || !profile || draftRef) return;
    const bootstrap = async () => {
      if (draftIdParam) {
        const row = await loadBookingDraft(draftIdParam);
        if (row) {
          setDraftRef({ localId: row.local_id || row.id, id: row.id || null, booking_code: row.booking_code });
          setBookingCode(row.booking_code || null);
          setBookingStatus(row.status || 'draft');
          if (row.client_id || row.client_name) {
            setSelectedClient({
              id: row.client_id,
              full_name: row.client_name || '',
              phone: row.client_phone || '',
              location: row.location || '',
            } as any);
          }
          if (row.service_date) setDate(new Date(row.service_date));
          if (row.agent_price) setAgentPrice(String(row.agent_price));
          if (Array.isArray(row.line_items) && row.line_items.length && services.length) {
            const items: LineItem[] = row.line_items
              .map((li: any) => {
                const svc = services.find((s) => s.id === li.serviceId);
                if (!svc) return null;
                return {
                  service: svc,
                  quantity: li.quantity || 1,
                  unitPrice: li.unitPrice || svc.price_min || 0,
                  total: li.total || 0,
                } as LineItem;
              })
              .filter(Boolean) as LineItem[];
            setLineItems(items);
          }
          if (row.salesperson_id) {
            setSalesperson({
              id: row.salesperson_id,
              name: row.salesperson_name || '',
              role: row.salesperson_role || 'admin',
            });
          }
          setHydrated(true);
          return;
        }
      }
      const ref = await createDraftBooking({
        userId: user.id,
        userName: profile.full_name || 'Admin',
        userRole: 'admin',
      });
      setDraftRef(ref);
      setHydrated(true);
      setTimeout(async () => {
        const row = await loadBookingDraft(ref.localId);
        if (row?.booking_code) {
          setBookingCode(row.booking_code);
          setDraftRef((cur) => cur ? { ...cur, id: row.id, booking_code: row.booking_code } : cur);
        }
      }, 1200);
    };
    bootstrap();
  }, [user, profile, draftIdParam, services]);

  const systemPrice = lineItems.reduce((sum, item) => sum + item.total, 0);
  const currentAgentPrice = Number(agentPrice) || 0;
  const agentMargin = currentAgentPrice > systemPrice ? currentAgentPrice - systemPrice : 0;
  const finalPrice = currentAgentPrice >= systemPrice ? currentAgentPrice : systemPrice;
  const priceError = currentAgentPrice > 0 && currentAgentPrice < systemPrice
    ? `Price cannot be less than Ksh ${systemPrice.toLocaleString()}` : null;
  const tier = getTier(0);
  const commission = null;

  const hasServices = lineItems.length > 0;
  const primaryService = lineItems[0]?.service || null;

  const handleLineItemsChange = (items: LineItem[]) => {
    setLineItems(items);
    const newSystemPrice = items.reduce((sum, item) => sum + item.total, 0);
    if (!agentPrice || currentAgentPrice <= systemPrice) {
      setAgentPrice(newSystemPrice > 0 ? String(newSystemPrice) : '');
    }
  };

  const completionPercent = useMemo(() => computeCompletionPercent({
    hasClient: !!selectedClient,
    serviceCount: lineItems.length,
    hasDate: !!date,
    priceValid: currentAgentPrice >= systemPrice && systemPrice > 0,
  }), [selectedClient, lineItems, date, currentAgentPrice, systemPrice]);

  const autoSavePayload = useMemo(() => ({
    client_id: selectedClient?.id || null,
    client_name: selectedClient?.full_name || '',
    client_phone: selectedClient?.phone || '',
    location: selectedClient?.location || '',
    service_id: primaryService?.id || null,
    service_date: date ? format(date, 'yyyy-MM-dd') : null,
    price: finalPrice,
    system_price: systemPrice,
    agent_price: finalPrice,
    agent_margin: agentMargin,
    quantity: String(lineItems.length),
    line_items: lineItems.map((i) => ({
      serviceName: i.service.name,
      serviceId: i.service.id,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      total: i.total,
    })),
    salesperson_id: salesperson.id || user?.id,
    salesperson_name: salesperson.name || profile?.full_name || 'Admin',
    salesperson_role: salesperson.role || 'admin',
    completion_percent: completionPercent,
  }), [selectedClient, primaryService, date, finalPrice, systemPrice, agentMargin, lineItems, salesperson, user, profile, completionPercent]);

  const { status: saveStatus, lastSavedAt } = useAutoSaveDraft({
    value: autoSavePayload,
    enabled: hydrated && !!draftRef && bookingStatus === 'draft',
    onSave: async (val) => {
      if (!draftRef || !user) return;
      await patchDraft(draftRef, val, { userId: user.id, userName: profile?.full_name || 'Admin' });
    },
  });

  const canQuote = hasServices && !!selectedClient
    && currentAgentPrice >= systemPrice && systemPrice > 0 && !priceError;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !draftRef || !hasServices || !date || priceError || currentAgentPrice < systemPrice) return;
    if (!selectedClient) {
      toast({ title: 'Select a client', description: 'Search the CRM and select a client first.', variant: 'destructive' });
      return;
    }
    setLoading(true);

    await upsertClientForBooking({
      clientName: selectedClient.full_name,
      clientPhone: selectedClient.phone,
      location: selectedClient.location || '',
      bookingPrice: finalPrice,
      createdBy: user.id,
      createdByRole: 'admin',
    });

    await patchDraft(draftRef, {
      ...autoSavePayload,
      status: 'pending',
    }, { userId: user.id, userName: profile?.full_name || 'Admin' });

    setBookingStatus('pending');
    setLoading(false);

    try {
      const { autoCreateQuotationForBooking } = await import('@/lib/autoDocuments');
      await autoCreateQuotationForBooking({
        clientName: selectedClient.full_name,
        clientPhone: selectedClient.phone,
        clientLocation: selectedClient.location || '',
        lineItems: lineItems.map(i => ({ name: i.service.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
        totalAmount: finalPrice,
        serviceDate: date,
        createdById: user.id,
        createdBy: profile?.full_name || 'Admin',
        createdByRole: 'admin',
        bookingId: draftRef.id || undefined,
        clientId: selectedClient.id,
        salespersonName: salesperson.name || profile?.full_name || 'Admin',
      });
    } catch (e) { console.warn('Auto-quotation failed', e); }

    toast({ title: 'Booking confirmed', description: `${bookingCode || 'Booking'} moved to Pending.` });
    navigate('/admin/bookings');
  };

  const quotationLineItems = lineItems.map(i => ({
    name: i.service.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    total: i.total,
  }));

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">{draftIdParam ? 'Resume Booking' : 'Book Service (Admin)'}</h1>
        <Button size="sm" variant="ghost" onClick={() => navigate('/admin/bookings/drafts')}>Drafts</Button>
      </div>

      <div className="mb-3">
        <DraftStatusBadge
          status={saveStatus}
          lastSavedAt={lastSavedAt}
          bookingCode={bookingCode}
          bookingStatus={bookingStatus}
        />
      </div>

      <form onSubmit={handleConfirm} className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Services</CardTitle></CardHeader>
          <CardContent>
            <MultiServiceSelector services={services} lineItems={lineItems} onChange={handleLineItemsChange} />
          </CardContent>
        </Card>

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
                  <Input type="number" value={agentPrice} onChange={e => setAgentPrice(e.target.value)} min={systemPrice} required placeholder={`Min: ${systemPrice.toLocaleString()}`} />
                  {priceError && <p className="text-xs text-destructive">{priceError}</p>}
                  <p className="text-xs text-muted-foreground">Cannot be below Ksh {systemPrice.toLocaleString()}</p>
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
                clientName={selectedClient!.full_name}
                clientPhone={selectedClient!.phone}
                serviceName={lineItems.map(i => i.service.name).join(', ')}
                serviceDate={date}
                price={finalPrice}
                userId={user?.id || ''}
                userName={profile?.full_name || 'Admin'}
                userRole="admin"
                disabled={!canQuote}
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
          disabled={loading || !hasServices || !date || !selectedClient || !!priceError || systemPrice <= 0 || currentAgentPrice < systemPrice || bookingStatus !== 'draft'}
        >
          {loading ? 'Confirming…' : `Confirm Booking${lineItems.length > 1 ? ` (${lineItems.length} services)` : ''}`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Changes auto-save. Resume from Drafts anytime.
        </p>
      </form>
    </div>
  );
}
