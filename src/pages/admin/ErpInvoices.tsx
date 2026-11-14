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
import { Plus, FileText, Share2, CheckCircle2, CreditCard, Award } from 'lucide-react';
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

const STATUS_OPTIONS = ['unpaid', 'overdue', 'cancelled'];
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
      payment_status: 'pending_approval',
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
      paymentStatus: 'Pending Approval',
      notes: form.notes || undefined,
      createdById: user!.id,
      clientId: clientId || undefined,
      status: 'draft',
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
    const { data: approval, error: lookupError } = await (supabase.from('accounting_approvals').select('id') as any)
      .eq('entity_type', 'invoice').eq('entity_id', inv.id).eq('status', 'pending_approval').maybeSingle();
    if (lookupError || !approval?.id) {
      toast({ title: 'Approval request not found', description: lookupError?.message || 'Refresh and try again.', variant: 'destructive' });
      return;
    }
    const { error } = await (supabase as any).rpc('accounting_decide_approval', {
      p_approval_id: approval.id, p_decision: 'approved', p_note: null,
    });
    if (error) { toast({ title: 'Approval failed', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('audit_logs').insert({
      admin_id: user!.id, action: 'invoice.approved', target_type: 'invoice', target_id: inv.id,
      details: { invoice_number: inv.invoice_number, amount: inv.amount },
    });
    toast({ title: 'Invoice approved', description: 'Ready to record payment.' });
    fetchData();
  };

  const openPaymentDialog = (inv: Invoice) => {
    setMpesaCode(''); setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentAmount(String(inv.amount)); setPayInvoice(inv);
  };

  const submitPayment = async () => {
    if (!payInvoice) return;
    const code = mpesaCode.trim().toUpperCase();
    const amount = Number(paymentAmount);
    if (code.length < 6 || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Enter a valid payment amount and M-Pesa code', variant: 'destructive' });
      return;
    }
    setSubmittingPay(true);
    const { data: result, error } = await (supabase as any).rpc('record_invoice_payment', {
      p_invoice_id: payInvoice.id, p_amount: amount, p_payment_method: 'mpesa',
      p_payment_reference: code, p_payment_date: paymentDate,
    });
    setSubmittingPay(false);
    if (error) {
      toast({ title: 'Payment submission failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Payment submitted for independent approval',
      description: `KES ${amount.toLocaleString('en-KE')} recorded. Outstanding balance: KES ${Number(result?.outstanding_balance || 0).toLocaleString('en-KE')}. A receipt is issued after approval.`,
    });
    setPayInvoice(null); setMpesaCode(''); setPaymentAmount('');
    await fetchData();
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
                  <Select disabled value={form.payment_status} onValueChange={v => setForm(f => ({ ...f, payment_status: v }))}>
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
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center p-8"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Invoice #</TableHead><TableHead>Client</TableHead><TableHead>Service</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {invoices.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoices yet</TableCell></TableRow> :
                  invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                      <TableCell>
                        <div>{inv.client_name}</div>
                        {inv.mpesa_code && <div className="text-xs text-muted-foreground font-mono">M-Pesa: {inv.mpesa_code}</div>}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{inv.service}</TableCell>
                      <TableCell className="font-medium">KES {Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(inv.payment_status) as any} className="capitalize">
                          {STATUS_LABEL[inv.payment_status] || inv.payment_status}
                        </Badge>
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
                <Label>Payment Amount (KES)</Label>
                <Input type="number" min="0.01" max={payInvoice.amount} step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} />
                <p className="text-xs text-muted-foreground">Partial payments are supported and require independent approval before being treated as received.</p>
              </div>
              <div className="space-y-1.5">
                <Label>M-Pesa Confirmation Code <span className="text-destructive">*</span></Label>
                <Input value={mpesaCode} onChange={e => setMpesaCode(e.target.value.toUpperCase())} placeholder="e.g. SLM4XK7H8Z" maxLength={20} className="font-mono uppercase" />
                <p className="text-xs text-muted-foreground">Enter the transaction code from the M-Pesa SMS confirmation.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayInvoice(null)} disabled={submittingPay}>Cancel</Button>
                <Button onClick={submitPayment} disabled={submittingPay || mpesaCode.trim().length < 6}>
                  {submittingPay ? 'Submitting…' : 'Submit for Approval'}
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
