import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import QRCode from 'qrcode';
import {
  ArrowLeft, Plus, Save, FileText, CheckCircle2, MoreHorizontal, Bell,
  User as UserIcon, MapPin, Calendar as CalIcon, ShieldCheck,
  Pencil, Trash2, MessageCircle, ShieldAlert, BadgeCheck,
  Lock, Receipt, Award, Printer, Download, Phone, Mail, CreditCard,
} from 'lucide-react';

const VAT_RATE = 0.16;

function fmt(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function shortBookingNo(id: string) {
  return 'BK-' + (id || '').replace(/-/g, '').slice(0, 10).toUpperCase();
}
function numberToWords(num: number): string {
  // Lightweight English converter sufficient for KES amounts.
  if (!isFinite(num)) return '';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 1_000_000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    return inWords(Math.floor(n / 1_000_000)) + ' Million' + (n % 1_000_000 ? ' ' + inWords(n % 1_000_000) : '');
  };
  const whole = Math.floor(num);
  const cents = Math.round((num - whole) * 100);
  const wholePart = whole === 0 ? 'Zero' : inWords(whole);
  return `Kenya Shillings ${wholePart}${cents ? ` and ${inWords(cents)} Cents` : ''} Only.`;
}

const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200',
    fully_confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    not_required: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  const label = (status || '').replace(/_/g, ' ').toUpperCase();
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${map[status] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
      {label}
    </span>
  );
};

const SectionCard = ({
  icon: Icon, title, children, className = '',
}: { icon: any; title: string; children: React.ReactNode; className?: string }) => (
  <Card className={`shadow-sm border-slate-200 ${className}`}>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </CardContent>
  </Card>
);

const Field = ({ label, value, valueClass = '' }: { label: string; value: React.ReactNode; valueClass?: string }) => (
  <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
    <div className="text-xs text-slate-500">{label}</div>
    <div className={`text-sm text-slate-800 ${valueClass}`}>{value || '—'}</div>
  </div>
);

export default function AdminBookingDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [comment, setComment] = useState('');
  const [qrUrl, setQrUrl] = useState<string>('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select('*, services(name, category)')
      .eq('id', id)
      .maybeSingle();
    if (error) toast({ title: 'Failed to load booking', description: error.message, variant: 'destructive' });
    setBooking(data);
    setComment((data as any)?.discount_approval_comment || '');
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (!booking) return;
    QRCode.toDataURL(`CCS-VERIFY:${booking.id}`, { margin: 1, width: 160 })
      .then(setQrUrl).catch(() => setQrUrl(''));
  }, [booking?.id]);

  const lineItems = useMemo(() => {
    const raw = (booking?.line_items as any[]) || [];
    if (Array.isArray(raw) && raw.length) return raw;
    if (booking?.services?.name) {
      return [{
        serviceName: booking.services.name,
        description: booking.services.category || '',
        quantity: Number(booking.quantity) || 1,
        unit: 'JOB',
        unitPrice: Number(booking.system_price || booking.price) / (Number(booking.quantity) || 1),
        discountPercent: 0,
        discountAmount: 0,
      }];
    }
    return [];
  }, [booking]);

  const totals = useMemo(() => {
    const subtotal = Number(booking?.subtotal || booking?.system_price || booking?.price || 0);
    const discountAmount = Number(booking?.discount_amount || 0);
    const approved = booking?.discount_approval_status === 'approved' || booking?.discount_approval_status === 'not_required';
    const afterDiscount = approved ? subtotal - discountAmount : subtotal;
    const vat = afterDiscount * VAT_RATE;
    const grand = afterDiscount + vat;
    return { subtotal, discountAmount, afterDiscount, vat, grand, approved };
  }, [booking]);

  const approveDiscount = async (decision: 'approved' | 'rejected') => {
    if (!booking || !user) return;
    if (!comment.trim()) {
      toast({ title: 'Comment required', description: 'Please add an approval comment.', variant: 'destructive' });
      return;
    }
    setApproving(true);
    const { error } = await supabase.from('bookings').update({
      discount_approval_status: decision,
      discount_approval_comment: comment.trim(),
      discount_approved_at: new Date().toISOString(),
      discount_approved_by: user.id,
    } as any).eq('id', booking.id);
    setApproving(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: `Discount ${decision}` });
    load();
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading booking…</div>;
  }
  if (!booking) {
    return (
      <div className="p-6">
        <p className="text-sm">Booking not found.</p>
        <Button asChild variant="link" className="px-0"><Link to="/admin/bookings">Back to Bookings</Link></Button>
      </div>
    );
  }

  const bookingNo = shortBookingNo(booking.id);
  const clientCode = booking.client_id ? 'CCS' + booking.client_id.replace(/-/g, '').slice(0, 7).toUpperCase() : '—';
  const locationCode = (booking.location || '').slice(0, 3).toUpperCase() || '—';

  return (
    <div className="space-y-4 -mx-2 sm:mx-0">
      {/* Top action bar */}
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-600">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm">
          <span className="text-slate-500">Welcome, </span>
          <span className="font-semibold text-primary">{profile?.full_name || 'Admin'}</span>
          <div className="text-[11px] text-slate-500">Role: Administrator</div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button asChild size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <Link to="/admin/book"><Plus className="h-3.5 w-3.5 mr-1" /> New Booking</Link>
          </Button>
          <Button size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
            <Save className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
          <Button size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
            <FileText className="h-3.5 w-3.5 mr-1" /> Quotation
          </Button>
          <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Confirm
          </Button>
          <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">
            <Lock className="h-3.5 w-3.5 mr-1" /> Lock
          </Button>
          <Button size="sm" variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <FileText className="h-3.5 w-3.5 mr-1" /> Invoice
          </Button>
          <Button size="sm" variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <Receipt className="h-3.5 w-3.5 mr-1" /> Receipt
          </Button>
          <Button size="sm" variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
            <Award className="h-3.5 w-3.5 mr-1" /> Certificate
          </Button>
          <Button size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Print
          </Button>
          <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">
            <Download className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
        </div>
        <Button size="icon" variant="ghost" className="relative text-slate-600">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">3</span>
        </Button>
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
          {(profile?.full_name || 'A').split(' ').map(s => s[0]).slice(0, 2).join('')}
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="px-1">
        <h1 className="text-xl font-bold text-slate-800">Booking Details</h1>
        <div className="text-xs text-slate-500 mt-0.5">
          <Link to="/admin" className="hover:text-primary">Home</Link>
          <span className="mx-1.5">›</span>
          <Link to="/admin/bookings" className="hover:text-primary">Bookings</Link>
          <span className="mx-1.5">›</span>
          <span className="text-slate-700">Booking Details</span>
        </div>
      </div>

      {/* Booking summary header */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
            <div>
              <p className="text-xs text-slate-500">Booking No.</p>
              <p className="text-lg font-bold text-primary">{bookingNo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Booking Date</p>
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                {format(new Date(booking.service_date || booking.created_at), 'dd/MM/yyyy')}
                <CalIcon className="h-3.5 w-3.5 text-slate-400" />
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <StatusPill status={booking.status} />
            </div>
            <div>
              <p className="text-xs text-slate-500">Booking Type</p>
              <p className="text-sm font-semibold text-slate-800">Regular</p>
            </div>
            <div className="flex items-center gap-2 justify-end">
              {qrUrl ? (
                <img src={qrUrl} alt="Verification QR" className="h-16 w-16 border border-slate-200 rounded" />
              ) : <div className="h-16 w-16 bg-slate-50 border border-slate-200 rounded" />}
              <div className="text-[11px] text-slate-500 leading-tight">
                Scan to Verify<br />Booking
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <SectionCard icon={UserIcon} title="Client Information">
          <Field label="Client Code" value={clientCode} />
          <Field label="Client Name" value={<span className="font-semibold uppercase">{booking.client_name}</span>} />
          <Field label="Phone" value={booking.client_phone} />
          <Field label="Email" value={booking.client_email || '—'} />
          <Field label="Address" value={booking.location} />
          <Field label="Category" value={<Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">{booking.client_category || 'Regular'}</Badge>} />
          <div className="grid grid-cols-2 gap-1.5 pt-2">
            {booking.client_id && (
              <Button asChild size="sm" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50 col-span-2">
                <Link to={`/admin/clients/${booking.client_id}`}>View Client Profile</Link>
              </Button>
            )}
            <Button size="sm" variant="outline" className="border-slate-200 h-8">
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
            {booking.client_phone && (
              <Button asChild size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-8">
                <a href={`tel:${booking.client_phone}`}><Phone className="h-3 w-3 mr-1" /> Call</a>
              </Button>
            )}
            {booking.client_phone && (
              <Button asChild size="sm" variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-8 col-span-2">
                <a href={`https://wa.me/${booking.client_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                </a>
              </Button>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={MapPin} title="Service Location">
          <Field label="Site Name" value={<span className="font-semibold uppercase">{(booking.location || '').split(',')[0]}</span>} />
          <Field label="Address" value={booking.location} />
          <Field label="GPS" value={booking.gps_coordinates || '—'} />
          <Field label="Contact" value={booking.site_contact_name || booking.client_name || '—'} />
          <Field label="Contact Phone" value={booking.site_contact_phone || booking.client_phone || '—'} />
          <Button size="sm" variant="outline" className="w-full mt-2 border-blue-200 text-blue-700 hover:bg-blue-50">View Location</Button>
        </SectionCard>

        <SectionCard icon={CalIcon} title="Booking Information">
          <Field label="Salesperson" value={<span className="font-semibold uppercase text-primary">{booking.salesperson_name || booking.created_by_name || '—'}</span>} />
          <Field label="Technician" value={booking.assigned_technician || '—'} />
          <Field label="Preferred Date" value={format(new Date(booking.service_date || booking.created_at), 'dd/MM/yyyy')} />
          <Field label="Preferred Time" value={booking.preferred_time || '09:00 AM'} />
          <Field label="Payment Terms" value={booking.payment_terms || 'Cash'} />
          <Field label="Booking Source" value={booking.source || 'Direct'} />
          <Field label="Created By" value={booking.created_by_name || '—'} />
        </SectionCard>

        <SectionCard icon={ShieldCheck} title="Status & Approval">
          <div>
            <p className="text-xs text-slate-500 mb-1">Booking Status</p>
            <StatusPill status={booking.status} />
          </div>
          <div className="mt-2">
            <p className="text-xs text-slate-500 mb-1">Approval Status</p>
            <StatusPill status={booking.discount_approval_status || 'not_required'} />
          </div>
          <Field label="Approved By" value={booking.discount_approved_by ? 'Admin User' : '—'} />
          <Field label="Approved On" value={booking.discount_approved_at ? format(new Date(booking.discount_approved_at), 'dd/MM/yyyy hh:mm a') : '—'} />
          <div className="mt-2">
            <p className="text-xs text-slate-500 mb-1">Locked</p>
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${booking.is_locked ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              <Lock className="h-3 w-3" /> {booking.is_locked ? 'Locked' : 'Unlocked'}
            </span>
          </div>
        </SectionCard>
      </div>

      {/* Services table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-slate-700">Services</h3>
            </div>
            <Button size="sm" className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">#</th>
                  <th className="px-3 py-2 text-left font-semibold">Service</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-center font-semibold">Qty</th>
                  <th className="px-3 py-2 text-center font-semibold">Unit</th>
                  <th className="px-3 py-2 text-right font-semibold">Unit Price (KES)</th>
                  <th className="px-3 py-2 text-right font-semibold">Discount (%)</th>
                  <th className="px-3 py-2 text-right font-semibold">Discount (KES)</th>
                  <th className="px-3 py-2 text-right font-semibold">VAT (16%)</th>
                  <th className="px-3 py-2 text-right font-semibold">Total (KES)</th>
                  <th className="px-3 py-2 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((it: any, i: number) => {
                  const qty = Number(it.quantity || 1);
                  const unitPrice = Number(it.unitPrice || 0);
                  const gross = qty * unitPrice;
                  const lineDiscPct = Number(it.discountPercent || 0);
                  const lineDiscAmt = Number(it.discountAmount || (gross * lineDiscPct / 100));
                  const afterDisc = gross - lineDiscAmt;
                  const vat = afterDisc * VAT_RATE;
                  const total = afterDisc + vat;
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{it.serviceName || it.name}</td>
                      <td className="px-3 py-2 text-slate-600">{it.description || ''}</td>
                      <td className="px-3 py-2 text-center">{qty}</td>
                      <td className="px-3 py-2 text-center text-slate-600">{it.unit || 'JOB'}</td>
                      <td className="px-3 py-2 text-right">{fmt(unitPrice)}</td>
                      <td className="px-3 py-2 text-right">{lineDiscPct.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{fmt(lineDiscAmt)}</td>
                      <td className="px-3 py-2 text-right">{fmt(vat)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">{fmt(total)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <button className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                          <button className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan={5} className="px-3 py-2 text-sm font-semibold text-slate-700">Total Items: {lineItems.length}</td>
                  <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-slate-700">Sub Total (Before Discount):</td>
                  <td className="px-3 py-2 text-right text-sm font-bold text-slate-900">KES {fmt(totals.subtotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Discount + Approval + Price Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <SectionCard icon={ShieldAlert} title="Discount">
          <Field label="Discount Type" value={booking.discount_type === 'percent' ? 'Percentage (%)' : booking.discount_type === 'fixed' ? 'Fixed (KES)' : '—'} />
          <Field label="Discount Value" value={booking.discount_value ? (booking.discount_type === 'percent' ? `${booking.discount_value} %` : `KES ${fmt(Number(booking.discount_value))}`) : '—'} />
          <Field label="Discount Amount" value={`KES ${fmt(Number(booking.discount_amount || 0))}`} valueClass="font-semibold" />
          <div>
            <p className="text-xs text-slate-500 mb-1">Discount Reason *</p>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700 min-h-[60px]">
              {booking.discount_reason || '—'}
            </div>
          </div>
          <Separator className="my-2" />
          <Field label="Requested By" value={booking.created_by_name || '—'} />
          <Field label="Requested On" value={booking.discount_requested_at ? format(new Date(booking.discount_requested_at), 'dd/MM/yyyy hh:mm a') : '—'} />
        </SectionCard>

        <SectionCard icon={ShieldCheck} title="Discount Approval">
          <div>
            <p className="text-xs text-slate-500 mb-1">Status</p>
            <StatusPill status={booking.discount_approval_status || 'not_required'} />
          </div>
          <Field label="Approved By" value={booking.discount_approved_by ? 'Admin User' : '—'} />
          <Field label="Approved On" value={booking.discount_approved_at ? format(new Date(booking.discount_approved_at), 'dd/MM/yyyy hh:mm a') : '—'} />
          <div>
            <p className="text-xs text-slate-500 mb-1">Approval Comment</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Approved as per management discretion."
              className="min-h-[72px] text-sm"
              disabled={booking.discount_approval_status === 'approved' || booking.discount_approval_status === 'rejected'}
            />
          </div>
          {(booking.discount_approval_status === 'pending') && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button size="sm" onClick={() => approveDiscount('approved')} disabled={approving} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Discount
              </Button>
              <Button size="sm" variant="destructive" onClick={() => approveDiscount('rejected')} disabled={approving}>
                Reject Discount
              </Button>
            </div>
          )}
        </SectionCard>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-2 border-b border-slate-100">Price Breakdown</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Sub Total (Before Discount)</span>
                <span className="font-semibold text-slate-800">KES {fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Discount{booking.discount_value ? ` (${booking.discount_type === 'percent' ? booking.discount_value + '%' : 'fixed'})` : ''}</span>
                <span className="font-semibold text-red-600">- KES {fmt(totals.approved ? totals.discountAmount : 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sub Total (After Discount)</span>
                <span className="font-semibold text-slate-800">KES {fmt(totals.afterDiscount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">VAT (16%)</span>
                <span className="font-semibold text-slate-800">+ KES {fmt(totals.vat)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center bg-blue-50 -mx-2 px-3 py-2 rounded-md">
                <span className="text-base font-bold text-slate-800">Grand Total</span>
                <span className="text-lg font-extrabold text-primary">KES {fmt(totals.grand)}</span>
              </div>
              <div className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 p-2.5">
                <p className="text-[11px] font-semibold text-emerald-700 mb-0.5">Amount in Words</p>
                <p className="text-xs text-emerald-900 leading-snug">{numberToWords(totals.grand)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Payments / Attachments / Notes / History / Activity */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <Tabs defaultValue="payments">
            <TabsList className="bg-transparent border-b border-slate-100 w-full justify-start rounded-none px-3 h-auto">
              {['payments', 'attachments', 'notes', 'history', 'activity'].map(t => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="capitalize data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none px-3 py-2.5"
                >
                  {t === 'activity' ? 'Activity Log' : t}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="payments" className="p-4 mt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Field label="Payment Terms" value="Cash" />
                  <Field label="Deposit Amount" value="KES 0.00" />
                  <Field label="Amount Paid" value="KES 0.00" />
                  <Field label="Balance Amount" value={<span className="text-red-600 font-bold">KES {fmt(totals.grand)}</span>} />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase mb-1">M-Pesa Payment</h4>
                  <Field label="Paybill No." value="400222" />
                  <Field label="Account No." value={bookingNo} />
                  <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> Send Payment Instructions
                  </Button>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-slate-600 uppercase">Payment History</h4>
                    <Button size="sm" variant="outline" className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50">
                      <Plus className="h-3 w-3 mr-1" /> Record Payment
                    </Button>
                  </div>
                  <div className="rounded-md border border-dashed border-slate-200 p-6 text-center">
                    <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs text-slate-500">No payments recorded yet.</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {['attachments', 'notes', 'history', 'activity'].map(t => (
              <TabsContent key={t} value={t} className="p-6 mt-0">
                <p className="text-sm text-slate-500 text-center">No {t === 'activity' ? 'activity' : t} yet.</p>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-2 py-3 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <div>
            <p className="font-semibold text-slate-700">GENERATED ON</p>
            <p>{format(new Date(booking.created_at), 'dd/MM/yyyy hh:mm a')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-blue-600" />
          <div>
            <p className="font-semibold text-slate-700">GENERATED BY</p>
            <p>{booking.created_by_name || 'Admin'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-700">SECURED DOCUMENT</p>
            <p>Official Booking Document</p>
          </div>
        </div>
        {qrUrl && <img src={qrUrl} alt="Verify" className="h-14 w-14 border border-slate-200 rounded" />}
      </div>
    </div>
  );
}
