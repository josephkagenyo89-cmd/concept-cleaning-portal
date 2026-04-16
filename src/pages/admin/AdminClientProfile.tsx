import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Phone, MessageCircle, Plus, Calendar, DollarSign, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  returning: 'bg-green-100 text-green-800',
  vip: 'bg-amber-100 text-amber-800',
  inactive: 'bg-gray-100 text-gray-600',
};

export default function AdminClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [income, setIncome] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [clientRes, bookingsRes, invoicesRes, incomeRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('bookings').select('*, services(name)').eq('client_id', id as string).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('client_id', id as string).order('created_at', { ascending: false }),
      (supabase.from('income_records').select('*') as any).eq('client_id', id as string).order('date', { ascending: false }),
    ]);

    if (clientRes.data) {
      setClient(clientRes.data);
      setNotes((clientRes.data as any).notes || '');
    }
    setBookings((bookingsRes.data as any[]) || []);
    setInvoices((invoicesRes.data as any[]) || []);
    setIncome((incomeRes.data as any[]) || []);
    setLoading(false);
  };

  const saveNotes = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase.from('clients').update({ notes } as any).eq('id', id);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Notes saved' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Client not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/clients')}>Go Back</Button>
      </div>
    );
  }

  const waNumber = ((client.whatsapp_number || client.phone) as string).replace(/\D/g, '');
  const waFormatted = waNumber.startsWith('0') ? `254${waNumber.slice(1)}` : waNumber;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/clients')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Clients
      </Button>

      {/* Client Header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold">{client.full_name}</h1>
              <p className="text-sm text-muted-foreground">{client.phone}</p>
              {client.location && <p className="text-sm text-muted-foreground">{client.location}</p>}
            </div>
            <Badge className={`capitalize ${statusColors[client.status] || ''}`}>{client.status}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <DollarSign className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="font-bold text-sm">Ksh {Number(client.total_spend).toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Total Spend</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <BookOpen className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="font-bold text-sm">{client.booking_count}</p>
              <p className="text-[10px] text-muted-foreground">Bookings</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <Calendar className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className="font-bold text-sm">{client.last_booking_date ? format(new Date(client.last_booking_date), 'dd MMM') : '—'}</p>
              <p className="text-[10px] text-muted-foreground">Last Booking</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => window.open(`tel:${client.phone}`)}>
              <Phone className="h-3.5 w-3.5 mr-1" /> Call
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(`https://wa.me/${waFormatted}`, '_blank')}>
              <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
            </Button>
            <Button size="sm" onClick={() => navigate('/admin/book-service')}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New Booking
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Notes & Follow-Up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes about this client..."
            rows={3}
          />
          <Button size="sm" onClick={saveNotes} disabled={saving}>
            {saving ? 'Saving...' : 'Save Notes'}
          </Button>
        </CardContent>
      </Card>

      {/* Booking History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Booking History ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No bookings yet</p>
          ) : (
            <div className="space-y-2">
              {bookings.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                  <div>
                    <p className="font-medium">{b.services?.name || 'Service'}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(b.created_at), 'dd MMM yyyy')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">Ksh {Number(b.price).toLocaleString()}</p>
                    <Badge variant="outline" className="text-[10px] capitalize">{b.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Invoices ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No invoices yet</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                  <div>
                    <p className="font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.service}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">Ksh {Number(inv.amount).toLocaleString()}</p>
                    <Badge variant="outline" className="text-[10px] capitalize">{inv.payment_status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
