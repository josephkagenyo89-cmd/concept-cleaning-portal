import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchListWithCache } from '@/lib/offlineRepo';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Share2, CheckCircle2, CreditCard, Award, Search, ReceiptText, CircleDollarSign, AlertTriangle, Clock3 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { downloadDocumentPdf, shareDocumentWhatsApp, DocumentData } from '@/lib/documentPdf';
import { useGlobalDiscount } from '@/hooks/useGlobalDiscount';
import { applyGlobalDiscount, globalDiscountReason } from '@/lib/globalDiscount';
import ShareDocumentMenu from '@/components/documents/ShareDocumentMenu';
import { saveDocumentRecord } from '@/lib/documentSaver';
import GenerateCertificateButton from '@/components/booking/GenerateCertificateButton';
import { format as fmtDate } from 'date-fns';
import MultiServiceSelector, { LineItem } from '@/components/booking/MultiServiceSelector';
import SalespersonSelector from '@/components/booking/SalespersonSelector';
import { upsertClientForBooking } from '@/lib/clientManager';

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
  client_id: string | null;
  booking_id: string | null;
  mpesa_code?: string | null;
  payment_date?: string | null;
  subtotal?: number | null;
  discount_amount?: number | null;
  discount_reason?: string | null;
  discount_type?: string | null;
  discount_value?: number | null;
}

const STATUS_OPTIONS = ['unpaid', 'pending_approval', 'approved', 'paid', 'partial', 'overdue', 'cancelled'];
const STATUS_LABEL: Record<string, string> = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  paid: 'Paid',
  unpaid: 'Unpaid',
  partial: 'Partial',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export default function ErpInvoices() {
  const globalDiscount = useGlobalDiscount();
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const canApprove = isAdmin || isSuperAdmin;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [salesperson, setSalesperson] = useState({ id: '', name: '', role: 'admin' });
  const [form, setForm] = useState({
    client_name: '', client_phone: '', date: new Date().toISOString().split('T')[0],
    due_date: '', payment_status: 'pending_approval', notes: '',
  });

  // Payment dialog state
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [mpesaCode, setMpesaCode] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentBalance, setPaymentBalance] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash' | 'bank'>('mpesa');
  const [submittingPay, setSubmittingPay] = useState(false);

  // "Send to client" prompt state — fired after successful payment
  const [shareTarget, setShareTarget] = useState<{ invoice: Invoice; receipt: DocumentData; certificate: DocumentData | null } | null>(null);

  useEffect(() => {
    if (user && profile) {
      setSalesperson({ id: user.id, name: profile.full_name || 'Admin', role: 'admin' });
    }
  }, [user, profile]);

  const fetchData = async () => {
    const data = await fetchListWithCache<Invoice>('invoices', async () =>
      await supabase.from('invoices').select('*').order('created_at', { ascending: false })
    );
    setInvoices(data);
    setLoading(false);
  };

  // Payment tracking is derived from existing invoice records; this UI does not mutate invoice data.
  const today = new Date().toISOString().slice(0, 10);
  const isOutstanding = (inv: Invoice) => !['paid', 'cancelled'].includes(inv.payment_status);
  const isOverdue = (inv: Invoice) => isOutstanding(inv) && !!inv.due_date && inv.due_date < today;
  const paidInvoices = invoices.filter(inv => inv.payment_status === 'paid');
  const outstandingInvoices = invoices.filter(isOutstanding);
  const overdueInvoices = invoices.filter(isOverdue);
  const filteredInvoices = invoices.filter(inv => {
    const query = invoiceSearch.trim().toLowerCase();
    const matchesSearch = !query || [inv.invoice_number, inv.client_name, inv.client_phone || '', inv.service]
      .some(value => value.toLowerCase().includes(query));
    const matchesFilter = invoiceFilter === 'all'
      || (invoiceFilter === 'paid' && inv.payment_status === 'paid')
      || (invoiceFilter === 'unpaid' && isOutstanding(inv))
      || (invoiceFilter === 'overdue' && isOverdue(inv))
      || (invoiceFilter === 'pending_approval' && inv.payment_status === 'pending_approval');
    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    fetchData();
    (async () => {
      const services = await fetchListWithCache<any>('services', async () =>
        await supabase.from('services').select('*').eq('is_active', true)
      );
      setServices(services);
    })();
  }, []);

  const generateInvoiceNumber = async () => {
    const { data } = await supabase.rpc('next_invoice_number' as any);
    return (data as string) || `INV-${Date.now()}`;
  };

  const buildInvoiceDocData = (inv: Invoice): DocumentData => {
    const items = inv.line_items && inv.line_items.length > 0
      ? inv.line_items.map((i: any) => ({ name: i.name, description: i.description || i.serviceCode || undefined, quantity: i.quantity || 1, unitPrice: i.unitPrice || i.total, total: i.total }))
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
      subtotal: inv.subtotal != null ? Number(inv.subtotal) : undefined,
      discountAmount: Number(inv.discount_amount) || 0,
      discountReason: inv.discount_reason || undefined,
      discountType: inv.discount_type || undefined,
      discountValue: inv.discount_value != null ? Number(inv.discount_value) : undefined,
      paymentStatus: STATUS_LABEL[inv.payment_status] || inv.payment_status,
      notes: inv.notes || undefined,
    };
  };

  const handleDownloadPdf = (inv: Invoice) => downloadDocumentPdf(buildInvoiceDocData(inv));
  const handleShareWhatsApp = (inv: Invoice) => shareDocumentWhatsApp(buildInvoiceDocData(inv));

  const handleSubmit = async () => {
    if (!form.client_name || !form.client_phone || lineItems.length === 0) {
      toast({ title: 'Client name, phone and at least one service are required', variant: 'destructive' });
      return;
    }
    const grossTotal = lineItems.reduce((s, i) => s + i.total, 0);
    const invDiscount = applyGlobalDiscount(grossTotal, globalDiscount);
    const totalAmount = invDiscount.final;
    const invNum = await generateInvoiceNumber();
    const clientId = await upsertClientForBooking({
      clientName: form.client_name,
      clientPhone: form.client_phone,
      location: '',
      bookingPrice: totalAmount,
      createdBy: user!.id,
      createdByRole: 'admin',
    });
    if (!clientId) {
      toast({ title: 'Could not link to client record', variant: 'destructive' });
      return;
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
      subtotal: grossTotal,
      discount_amount: invDiscount.discountAmount,
      discount_reason: invDiscount.active ? globalDiscountReason(globalDiscount) : null,
      discount_type: invDiscount.active ? 'percent' : null,
      discount_value: invDiscount.active ? invDiscount.percentage : null,
      salesperson_id: salesperson.id,
      salesperson_name: salesperson.name,
      salesperson_role: salesperson.role,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }

    await saveDocumentRecord({
      documentType: 'invoice',
      documentNumber: invNum,
      dateCreated: fmtDate(new Date(), 'PPP'),
      createdBy: salesperson.name || profile?.full_name || 'Admin',
      createdByRole: 'admin',
      clientName: form.client_name,
      clientPhone: form.client_phone || undefined,
      lineItems: lineItemsData.map((i: any) => ({ name: i.name, description: i.description || i.serviceCode || undefined, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })),
      totalAmount,
      subtotal: grossTotal,
      discountAmount: invDiscount.discountAmount,
      discountReason: invDiscount.active ? globalDiscountReason(globalDiscount) : undefined,
      discountType: invDiscount.active ? 'percent' : undefined,
      discountValue: invDiscount.active ? invDiscount.percentage : undefined,
      paymentStatus: form.payment_status,
      notes: form.notes || undefined,
      createdById: user!.id,
      clientId: clientId || undefined,
      status: form.payment_status === 'paid' ? 'paid' : 'draft',
    });

    toast({ title: 'Invoice created & saved to documents' });
    setOpen(false);
    setForm({ client_name: '', client_phone: '', date: new Date().toISOString().split('T')[0], due_date: '', payment_status: 'pending_approval', notes: '' });
    setLineItems([]);
    fetchData();
  };

  const approveInvoice = async (inv: Invoice) => {
    if (!canApprove) {
      toast({ title: 'Only Admins can approve', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('invoices').update({ payment_status: 'approved' } as any).eq('id', inv.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('audit_logs').insert({
      admin_id: user!.id, action: 'invoice.approved', target_type: 'invoice', target_id: inv.id,
      details: { invoice_number: inv.invoice_number, amount: inv.amount },
    });
    toast({ title: 'Invoice approved', description: 'Ready to record payment.' });
    fetchData();
  };

  const openPaymentDialog = async (inv: Invoice) => {
    setMpesaCode('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('mpesa');
    const { data, error } = await (supabase as any).from('invoice_payments').select('amount').eq('invoice_id', inv.id);
    if (error) {
      toast({ title: 'Could not load payment balance', description: error.message, variant: 'destructive' });
      return;
    }
    const paid = (data || []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    const balance = Math.max(0, Number(inv.amount || 0) - paid);
    setPaymentBalance(balance);
    setPaymentAmount(balance.toFixed(2));
    setPayInvoice(inv);
  };

  const submitPayment = async () => {
    if (!payInvoice) return;
    const amount = Number(paymentAmount);
    const code = mpesaCode.trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || amount > paymentBalance) {
      toast({ title: 'Invalid payment amount', description: `Enter an amount greater than zero and no more than KES ${paymentBalance.toLocaleString()}.`, variant: 'destructive' });
      return;
    }
    if (paymentMethod !== 'cash' && code.length < 3) {
      toast({ title: 'Payment reference required', description: 'Enter the M-Pesa confirmation code or bank reference.', variant: 'destructive' });
      return;
    }
    setSubmittingPay(true);
    const inv = payInvoice;

    try {
      const { data: paymentResult, error: paymentError } = await supabase.rpc('record_invoice_payment' as any, {
        p_invoice_id: inv.id,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_payment_reference: code || null,
        p_payment_date: paymentDate,
      } as any);
      if (paymentError) throw paymentError;
      const result = paymentResult as any;
      if (!result?.success) throw new Error('The payment was not confirmed by the server.');

      const { data: rNum } = await supabase.rpc('next_receipt_number' as any);
      const receiptNumber = (rNum as string) || `CCS-RCP-${Date.now()}`;
      const receiptDoc: DocumentData = {
        documentType: 'receipt',
        documentNumber: receiptNumber,
        dateCreated: fmtDate(new Date(`${paymentDate}T00:00:00`), 'PPP'),
        createdBy: profile?.full_name || 'Admin',
        createdByRole: 'admin',
        clientName: inv.client_name,
        clientPhone: inv.client_phone || undefined,
        lineItems: [{ name: `Payment against invoice ${inv.invoice_number}`, quantity: 1, unitPrice: amount, total: amount }],
        totalAmount: amount,
        subtotal: amount,
        discountAmount: 0,
        paymentStatus: 'PAYMENT RECEIVED',
        mpesaCode: paymentMethod === 'mpesa' ? code : undefined,
        paymentDate: fmtDate(new Date(`${paymentDate}T00:00:00`), 'PPP'),
        invoiceNumber: inv.invoice_number,
        amountPaid: amount,
      };

      await saveDocumentRecord({
        ...receiptDoc,
        createdById: user!.id,
        invoiceId: inv.id,
        bookingId: inv.booking_id || undefined,
        clientId: inv.client_id || undefined,
        status: 'paid',
      });

      await supabase.from('audit_logs').insert({
        admin_id: user!.id,
        action: 'invoice.payment_recorded',
        target_type: 'invoice',
        target_id: inv.id,
        details: { invoice_number: inv.invoice_number, payment_amount: amount, total_paid: result.total_paid, outstanding_balance: result.outstanding_balance, payment_method: paymentMethod, payment_reference: code || null },
      });

      toast({
        title: result.payment_status === 'paid' ? 'Invoice fully paid' : 'Partial payment recorded',
        description: `Received KES ${amount.toLocaleString()}. Balance: KES ${Number(result.outstanding_balance).toLocaleString()}. Income is pending Super Admin approval.`,
      });
      setPayInvoice(null);
      setSubmittingPay(false);
      await fetchData();
      const refreshedInv = { ...inv, payment_status: result.payment_status, mpesa_code: paymentMethod === 'mpesa' ? code : inv.mpesa_code, payment_date: paymentDate };
      setShareTarget({ invoice: refreshedInv, receipt: receiptDoc, certificate: null });
    } catch (err: any) {
      setSubmittingPay(false);
      toast({ title: 'Payment failed', description: err.message, variant: 'destructive' });
    }
  };

  const sendDocsToClient = () => {
    if (!shareTarget) return;
    const { invoice, receipt, certificate } = shareTarget;
    // Trigger downloads for each PDF
    downloadDocumentPdf(buildInvoiceDocData(invoice));
    downloadDocumentPdf(receipt);
    if (certificate) downloadDocumentPdf(certificate);

    // Compose WhatsApp message
    let phone = (invoice.client_phone || '').replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
    if (!phone.startsWith('254')) phone = '254' + phone;
    const lines = [
      `Hello ${invoice.client_name},`,
      ``,
      `Thank you for choosing Concept Cleaning Services. We appreciate your business.`,
      ``,
      `📄 Invoice: ${invoice.invoice_number}`,
      `🧾 Receipt: ${receipt.documentNumber}`,
    ];
    if (certificate) lines.push(`🏆 Service Certificate: ${certificate.documentNumber}`);
    lines.push(``, `💰 Amount Paid: Ksh ${Number(invoice.amount).toLocaleString()}`, `🔐 M-Pesa: ${invoice.mpesa_code}`, ``, `Please find your documents attached. Reach us anytime: +254796563741`);
    const message = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    setShareTarget(null);
  };

  const updateStatus = async (id: string, status: string) => {
    if ((status === 'approved' || status === 'pending_approval' || status === 'paid') && status !== 'paid') {
      // approval/withdrawal handled via dedicated buttons; allow only basic changes here
    }
    const inv = invoices.find(i => i.id === id);
    if (status === 'paid' && inv) {
      // Force the proper payment flow
      openPaymentDialog(inv);
      return;
    }
    await supabase.from('invoices').update({ payment_status: status }).eq('id', id);
    toast({ title: 'Status updated' });
    fetchData();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'default';
      case 'unpaid': case 'overdue': return 'destructive';
      case 'partial': return 'secondary';
      case 'approved': return 'default';
      case 'pending_approval': return 'secondary';
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
                <div><Label>Initial Status</Label>
                  <Select value={form.payment_status} onValueChange={v => setForm(f => ({ ...f, payment_status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending_approval">Pending Approval</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button className="w-full" onClick={handleSubmit}>Create Invoice</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="rounded-full bg-muted p-2"><ReceiptText className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">All invoices</p><p className="text-2xl font-semibold">{invoices.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="rounded-full bg-muted p-2"><CircleDollarSign className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Paid invoices</p><p className="text-2xl font-semibold">{paidInvoices.length}</p><p className="text-xs text-muted-foreground">KES {paidInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0).toLocaleString()} marked paid</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="rounded-full bg-muted p-2"><Clock3 className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Unpaid / awaiting payment</p><p className="text-2xl font-semibold">{outstandingInvoices.length}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="rounded-full bg-muted p-2"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Overdue invoices</p><p className="text-2xl font-semibold">{overdueInvoices.length}</p><p className="text-xs text-muted-foreground">Based on due date</p></div></CardContent></Card>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} placeholder="Search invoice number, client, phone or service…" aria-label="Search invoices" /></div>
        <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
          <SelectTrigger className="w-full sm:w-[220px]"><SelectValue placeholder="Filter invoices" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All invoices</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid / awaiting payment</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="pending_approval">Pending approval</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center p-8"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Invoice #</TableHead><TableHead>Client</TableHead><TableHead>Service</TableHead><TableHead>Amount</TableHead><TableHead>Due date</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {invoices.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No invoices yet</TableCell></TableRow> :
                  filteredInvoices.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No invoices match your search or filter.</TableCell></TableRow> :
                  filteredInvoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell>
                        <div>{inv.client_name}</div>
                        {inv.mpesa_code && <div className="text-xs text-muted-foreground font-mono">M-Pesa: {inv.mpesa_code}</div>}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{inv.service}</TableCell>
                      <TableCell className="font-medium">KES {Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell><span className={isOverdue(inv) ? 'text-destructive font-medium' : 'text-muted-foreground'}>{inv.due_date ? fmtDate(new Date(`${inv.due_date}T00:00:00`), 'dd MMM yyyy') : '—'}</span></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={statusColor(inv.payment_status) as any} className="capitalize">
                            {STATUS_LABEL[inv.payment_status] || inv.payment_status}
                          </Badge>
                          {isOverdue(inv) && <Badge variant="destructive">Overdue</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {inv.payment_status === 'pending_approval' && canApprove && (
                            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => approveInvoice(inv)}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />Approve
                            </Button>
                          )}
                          {['approved', 'partial'].includes(inv.payment_status) && (
                            <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => openPaymentDialog(inv)}>
                              <CreditCard className="h-3 w-3 mr-1" />Record Payment
                            </Button>
                          )}
                          {inv.payment_status === 'paid' && (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                              <Award className="h-3 w-3 mr-1" />Paid
                            </Badge>
                          )}
                          {inv.payment_status === 'paid' && inv.booking_id && (
                            <GenerateCertificateButton bookingId={inv.booking_id} onGenerated={fetchData} />
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownloadPdf(inv)} title="Download PDF">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          {inv.client_phone && (
                            <ShareDocumentMenu document={buildInvoiceDocData(inv)} iconOnly variant="ghost" size="icon" />
                          )}
                          {inv.payment_status !== 'paid' && inv.payment_status !== 'pending_approval' && inv.payment_status !== 'approved' && (
                            <Select value={inv.payment_status} onValueChange={v => updateStatus(inv.id, v)}>
                              <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{STATUS_LABEL[s] || s}</SelectItem>)}</SelectContent>
                            </Select>
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

      {/* Record Payment Dialog */}
      <Dialog open={!!payInvoice} onOpenChange={(o) => { if (!o) setPayInvoice(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {payInvoice && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted/50 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><span className="font-mono">{payInvoice.invoice_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span>{payInvoice.client_name}</span></div>
                <div className="flex justify-between font-semibold mt-1"><span>Amount</span><span>Ksh {Number(payInvoice.amount).toLocaleString()}</span></div>
              </div>
              <div className="space-y-1.5">
                <Label>Outstanding Balance</Label>
                <div className="font-semibold">KES {paymentBalance.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Amount (KES) <span className="text-destructive">*</span></Label>
                <Input type="number" min="0.01" max={paymentBalance} step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as 'mpesa' | 'cash' | 'bank')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod !== 'cash' && <div className="space-y-1.5">
                <Label>{paymentMethod === 'mpesa' ? 'M-Pesa Confirmation Code' : 'Bank Reference'} <span className="text-destructive">*</span></Label>
                <Input value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())} placeholder={paymentMethod === 'mpesa' ? 'e.g. SLM4XK7H8Z' : 'Enter bank transaction reference'} maxLength={40} className="font-mono uppercase" />
              </div>}
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayInvoice(null)} disabled={submittingPay}>Cancel</Button>
                <Button onClick={submitPayment} disabled={submittingPay || !paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > paymentBalance || (paymentMethod !== 'cash' && mpesaCode.trim().length < 3)}>
                  {submittingPay ? 'Recording…' : 'Record Payment'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send to Client Prompt */}
      <Dialog open={!!shareTarget} onOpenChange={(o) => { if (!o) setShareTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send documents to client?</DialogTitle>
          </DialogHeader>
          {shareTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                We'll download the PDFs and open WhatsApp with a thank-you message ready to send to <strong>{shareTarget.invoice.client_name}</strong>.
              </p>
              <ul className="text-sm space-y-1 pl-5 list-disc">
                <li>Invoice {shareTarget.invoice.invoice_number}</li>
                <li>Receipt {shareTarget.receipt.documentNumber}</li>
                {shareTarget.certificate && <li>Service Completion Certificate {shareTarget.certificate.documentNumber}</li>}
              </ul>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShareTarget(null)}>Skip</Button>
                <Button onClick={sendDocsToClient}>
                  <Share2 className="h-4 w-4 mr-1" />Send via WhatsApp
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
