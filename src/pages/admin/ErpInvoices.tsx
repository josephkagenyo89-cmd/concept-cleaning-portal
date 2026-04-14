import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Share2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { downloadDocumentPdf, shareDocumentWhatsApp, DocumentData } from '@/lib/documentPdf';
import { saveDocumentRecord } from '@/lib/documentSaver';
import { format as fmtDate } from 'date-fns';
import MultiServiceSelector, { LineItem } from '@/components/booking/MultiServiceSelector';
import SalespersonSelector from '@/components/booking/SalespersonSelector';

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_phone: string | null;
  service: string;
  amount: number;
  date: string;
  due_date: string | null;
  payment_status: string;
  notes: string | null;
  created_at: string;
  line_items: any[] | null;
  salesperson_name: string | null;
}

const STATUS_OPTIONS = ['unpaid', 'paid', 'partial', 'overdue', 'cancelled'];

export default function ErpInvoices() {
  const { user, profile, isSuperAdmin } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [salesperson, setSalesperson] = useState({ id: '', name: '', role: 'admin' });
  const [form, setForm] = useState({
    client_name: '', client_phone: '', date: new Date().toISOString().split('T')[0],
    due_date: '', payment_status: 'unpaid', notes: '',
  });

  useEffect(() => {
    if (user && profile) {
      setSalesperson({ id: user.id, name: profile.full_name || 'Admin', role: 'admin' });
    }
  }, [user, profile]);

  const fetchData = async () => {
    const { data } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
    setInvoices((data || []) as Invoice[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    supabase.from('services').select('*').eq('is_active', true).then(({ data }) => setServices(data || []));
  }, []);

  const generateInvoiceNumber = async () => {
    const { data } = await supabase.rpc('next_invoice_number' as any);
    return (data as string) || `INV-${Date.now()}`;
  };

  const buildInvoiceDocData = (inv: Invoice): DocumentData => {
    const items = inv.line_items && inv.line_items.length > 0
      ? inv.line_items.map((i: any) => ({ name: i.name, quantity: i.quantity || 1, unitPrice: i.unitPrice || i.total, total: i.total }))
      : [{ name: inv.service, total: Number(inv.amount) }];

    return {
      documentType: 'invoice',
      documentNumber: inv.invoice_number,
      dateCreated: fmtDate(new Date(inv.created_at), 'PPP'),
      createdBy: inv.salesperson_name || 'Admin',
      createdByRole: 'Admin',
      clientName: inv.client_name,
      clientPhone: inv.client_phone || undefined,
      lineItems: items,
      totalAmount: Number(inv.amount),
      paymentStatus: inv.payment_status,
      notes: inv.notes || undefined,
    };
  };

  const handleDownloadPdf = (inv: Invoice) => downloadDocumentPdf(buildInvoiceDocData(inv));
  const handleShareWhatsApp = (inv: Invoice) => shareDocumentWhatsApp(buildInvoiceDocData(inv));

  const handleSubmit = async () => {
    if (!form.client_name || lineItems.length === 0) {
      toast({ title: 'Add client name and at least one service', variant: 'destructive' });
      return;
    }
    const totalAmount = lineItems.reduce((s, i) => s + i.total, 0);
    const invNum = await generateInvoiceNumber();
    let clientId: string | null = null;
    if (form.client_phone) {
      const { data: client } = await supabase.from('clients').select('id').eq('phone', form.client_phone.trim()).maybeSingle();
      clientId = client?.id || null;
    }
    const lineItemsData = lineItems.map(i => ({
      name: i.service.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total,
    }));
    const { error } = await supabase.from('invoices').insert({
      invoice_number: invNum,
      client_name: form.client_name,
      client_phone: form.client_phone || null,
      service: lineItems.map(i => i.service.name).join(', '),
      amount: totalAmount,
      date: form.date,
      due_date: form.due_date || null,
      payment_status: form.payment_status,
      notes: form.notes || null,
      created_by: user!.id,
      client_id: clientId,
      line_items: lineItemsData,
      salesperson_id: salesperson.id,
      salesperson_name: salesperson.name,
      salesperson_role: salesperson.role,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    // Auto-save to documents module
    await saveDocumentRecord({
      documentType: 'invoice',
      documentNumber: invNum,
      dateCreated: fmtDate(new Date(), 'PPP'),
      createdBy: salesperson.name || profile?.full_name || 'Admin',
      createdByRole: 'admin',
      clientName: form.client_name,
      clientPhone: form.client_phone || undefined,
      lineItems: lineItemsData.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
      totalAmount,
      paymentStatus: form.payment_status,
      notes: form.notes || undefined,
      createdById: user!.id,
      clientId: clientId || undefined,
      status: form.payment_status === 'paid' ? 'paid' : 'draft',
    });

    toast({ title: 'Invoice created & saved to documents' });
    setOpen(false);
    setForm({ client_name: '', client_phone: '', date: new Date().toISOString().split('T')[0], due_date: '', payment_status: 'unpaid', notes: '' });
    setLineItems([]);
    fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    const invoice = invoices.find(i => i.id === id);
    await supabase.from('invoices').update({ payment_status: status }).eq('id', id);

    if (status === 'paid' && invoice) {
      const { data: existing } = await (supabase.from('income_records').select('id') as any).eq('invoice_id', id).maybeSingle();
      if (!existing) {
        await supabase.from('income_records').insert({
          amount: Number(invoice.amount),
          date: new Date().toISOString().split('T')[0],
          description: `Invoice ${invoice.invoice_number} — ${invoice.client_name} — ${invoice.service}`,
          service: invoice.service,
          payment_method: 'mpesa',
          source: 'client_payment',
          created_by: user!.id,
          invoice_id: id,
          status: 'pending_approval',
        } as any);
        toast({ title: 'Income record created — pending Super Admin approval' });
      }
    }
    toast({ title: 'Status updated' });
    fetchData();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'default';
      case 'unpaid': case 'overdue': return 'destructive';
      case 'partial': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Invoice</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Client Name *</Label><Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} /></div>
                <div><Label>Client Phone</Label><Input value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} /></div>
              </div>

              <SalespersonSelector value={salesperson} onChange={setSalesperson} />

              <MultiServiceSelector services={services} lineItems={lineItems} onChange={setLineItems} />

              <div className="grid grid-cols-3 gap-4">
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                <div><Label>Payment Status</Label>
                  <Select value={form.payment_status} onValueChange={v => setForm(f => ({ ...f, payment_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button className="w-full" onClick={handleSubmit}>Create Invoice</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center p-8"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Invoice #</TableHead><TableHead>Client</TableHead><TableHead>Service</TableHead><TableHead>Amount</TableHead><TableHead>Salesperson</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {invoices.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No invoices yet</TableCell></TableRow> :
                  invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.client_name}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{inv.service}</TableCell>
                      <TableCell className="font-medium">KES {Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{inv.salesperson_name || '-'}</TableCell>
                      <TableCell>
                        <Select value={inv.payment_status} onValueChange={v => updateStatus(inv.id, v)}>
                          <SelectTrigger className="w-[110px] h-7 text-xs"><Badge variant={statusColor(inv.payment_status) as any} className="capitalize">{inv.payment_status}</Badge></SelectTrigger>
                          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownloadPdf(inv)} title="Download PDF">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          {inv.client_phone && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-[hsl(142,70%,45%)]" onClick={() => handleShareWhatsApp(inv)} title="Share WhatsApp">
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
