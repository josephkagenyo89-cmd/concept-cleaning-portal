import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  const [submittingPay, setSubmittingPay] = useState(false);

  // "Send to client" prompt state — fired after successful payment
  const [shareTarget, setShareTarget] = useState<{ invoice: Invoice; receipt: DocumentData; certificate: DocumentData | null } | null>(null);

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
    const totalAmount = lineItems.reduce((s, i) => s + i.total, 0);
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

  const openPaymentDialog = (inv: Invoice) => {
    setMpesaCode('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPayInvoice(inv);
  };

  const submitPayment = async () => {
    if (!payInvoice) return;
    const code = mpesaCode.trim().toUpperCase();
    if (code.length < 6) {
      toast({ title: 'M-Pesa code is required', description: 'Enter the transaction code from the M-Pesa message.', variant: 'destructive' });
      return;
    }
    setSubmittingPay(true);
    const inv = payInvoice;

    try {
      // 1. Mark invoice paid
      const { error: invError } = await supabase.from('invoices').update({
        payment_status: 'paid',
        mpesa_code: code,
        payment_date: new Date(paymentDate).toISOString(),
      } as any).eq('id', inv.id);
      if (invError) throw invError;

      // 2. Auto-create income record (pending Super Admin approval per system rule)
      const { data: existingIncome } = await (supabase.from('income_records').select('id') as any).eq('invoice_id', inv.id).maybeSingle();
      if (!existingIncome) {
        await supabase.from('income_records').insert({
          amount: Number(inv.amount),
          date: paymentDate,
          description: `Invoice ${inv.invoice_number} — ${inv.client_name} — ${inv.service}`,
          service: inv.service,
          payment_method: 'mpesa',
          mpesa_code: code,
          source: 'client_payment',
          created_by: user!.id,
          invoice_id: inv.id,
          client_id: inv.client_id,
          booking_id: inv.booking_id,
          status: 'pending_approval',
        } as any);
      }

      // 3. Auto-generate receipt PDF record
      const { data: rNum } = await supabase.rpc('next_receipt_number' as any);
      const receiptNumber = (rNum as string) || `CCS-RCP-${Date.now()}`;
      const lineItemsData = (inv.line_items && inv.line_items.length > 0)
        ? inv.line_items.map((i: any) => ({ name: i.name, quantity: i.quantity || 1, unitPrice: i.unitPrice || i.total, total: i.total }))
        : [{ name: inv.service, quantity: 1, unitPrice: Number(inv.amount), total: Number(inv.amount) }];

      const receiptDoc: DocumentData = {
        documentType: 'receipt',
        documentNumber: receiptNumber,
        dateCreated: fmtDate(new Date(), 'PPP'),
        createdBy: profile?.full_name || 'Admin',
        createdByRole: 'admin',
        clientName: inv.client_name,
        clientPhone: inv.client_phone || undefined,
        lineItems: lineItemsData,
        totalAmount: Number(inv.amount),
        paymentStatus: 'PAID',
        mpesaCode: code,
        paymentDate: fmtDate(new Date(paymentDate), 'PPP'),
        invoiceNumber: inv.invoice_number,
        amountPaid: Number(inv.amount),
      };

      await saveDocumentRecord({
        ...receiptDoc,
        createdById: user!.id,
        invoiceId: inv.id,
        bookingId: inv.booking_id || undefined,
        clientId: inv.client_id || undefined,
        status: 'paid',
      });

      // 4. Auto-generate certificate (only when booking has both signatures)
      let certificateDoc: DocumentData | null = null;
      if (inv.booking_id) {
        const { data: booking } = await supabase
          .from('bookings')
          .select('client_signature, staff_signature, client_signed_at, staff_signed_at, staff_signed_name, location, service_date')
          .eq('id', inv.booking_id)
          .maybeSingle();

        if (booking?.client_signature && booking?.staff_signature) {
          const { data: cNum } = await supabase.rpc('next_certificate_number' as any);
          const certificateNumber = (cNum as string) || `CCS-CERT-${Date.now()}`;
          certificateDoc = {
            documentType: 'service_certificate',
            documentNumber: certificateNumber,
            dateCreated: fmtDate(new Date(), 'PPP'),
            createdBy: profile?.full_name || 'Admin',
            createdByRole: 'admin',
            clientName: inv.client_name,
            clientPhone: inv.client_phone || undefined,
            clientLocation: (booking as any).location,
            lineItems: lineItemsData,
            totalAmount: Number(inv.amount),
            paymentStatus: 'PAID',
            mpesaCode: code,
            paymentDate: fmtDate(new Date(paymentDate), 'PPP'),
            invoiceNumber: inv.invoice_number,
            amountPaid: Number(inv.amount),
            serviceDate: (booking as any).service_date ? fmtDate(new Date((booking as any).service_date), 'PPP') : undefined,
            signatures: {
              clientSignature: (booking as any).client_signature,
              clientName: inv.client_name,
              clientSignedAt: (booking as any).client_signed_at,
              staffSignature: (booking as any).staff_signature,
              staffName: (booking as any).staff_signed_name,
              staffSignedAt: (booking as any).staff_signed_at,
            },
            notes: 'This certificate confirms that the cleaning service has been completed satisfactorily and payment has been received in full.',
          };
          await saveDocumentRecord({
            ...certificateDoc,
            createdById: user!.id,
            invoiceId: inv.id,
            bookingId: inv.booking_id,
            clientId: inv.client_id || undefined,
            status: 'completed',
          });
        }
      }

      await supabase.from('audit_logs').insert({
        admin_id: user!.id, action: 'invoice.paid', target_type: 'invoice', target_id: inv.id,
        details: { invoice_number: inv.invoice_number, amount: inv.amount, mpesa_code: code, certificate_generated: !!certificateDoc },
      });

      toast({
        title: 'Payment recorded',
        description: certificateDoc
          ? 'Receipt + Service Certificate generated. Income pending approval.'
          : 'Receipt generated. Income pending approval. (Certificate requires both signatures.)',
      });

      setPayInvoice(null);
      setSubmittingPay(false);
      // Refresh and offer share
      await fetchData();
      // Offer to share with client via WhatsApp
      const refreshedInv = { ...inv, payment_status: 'paid', mpesa_code: code, payment_date: paymentDate };
      setShareTarget({ invoice: refreshedInv, receipt: receiptDoc, certificate: certificateDoc });
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
                          {inv.payment_status === 'approved' && (
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
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-[hsl(142,70%,45%)]" onClick={() => handleShareWhatsApp(inv)} title="Share WhatsApp">
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
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
                  {submittingPay ? 'Recording…' : 'Mark as Paid'}
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
