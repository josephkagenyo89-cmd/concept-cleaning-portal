import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, CalendarDays, CheckCircle2, FileText, Plus, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';

type Row = Record<string, any>;
const db = (table: string) => (supabase as any).from(table);
const today = new Date().toISOString().slice(0, 10);
const kes = (value: number) => 'KES ' + Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyContract = {
  client_id: '', company_legal_name: '', company_registration_number: '', billing_contact_name: '',
  billing_email: '', billing_phone: '', billing_address: '', scope_of_work: '',
  pricing_model: '', fixed_monthly_fee: '', per_visit_rate: '', per_sqm_rate: '',
  hybrid_fixed_fee: '', hybrid_visit_rate: '', hybrid_per_sqm_rate: '',
  billing_frequency: '', payment_terms_days: '', start_date: '', end_date: '',
  renewal_notice_days: '',
};

export default function CommercialContracts() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Row[]>([]);
  const [clients, setClients] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [sites, setSites] = useState<Row[]>([]);
  const [schedules, setSchedules] = useState<Row[]>([]);
  const [visits, setVisits] = useState<Row[]>([]);
  const [clientInvoices, setClientInvoices] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);
  const [bookings, setBookings] = useState<Row[]>([]);
  const [pestJobs, setPestJobs] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [contractForm, setContractForm] = useState(emptyContract);
  const [siteForm, setSiteForm] = useState({ site_name: '', address: '', contact_name: '', contact_phone: '', area_sqm: '', notes: '' });
  const [scheduleForm, setScheduleForm] = useState({ site_id: '', service_description: '', frequency: '', interval_count: '1', visits_per_cycle: '1', weekday: '', preferred_time: '', start_date: '', end_date: '', notes: '' });
  const [visitForm, setVisitForm] = useState({ site_id: '', schedule_id: '', booking_id: '', pest_job_id: '', scheduled_date: today, fixed_staff_cost: '', supplies_cost: '', transport_cost: '', equipment_cost: '', other_cost: '', notes: '' });
  const [invoiceForm, setInvoiceForm] = useState({ invoice_id: '', site_id: '' });

  const selected = contracts.find((item) => item.id === selectedId) || null;

  const loadContracts = useCallback(async () => {
    setLoading(true);
    const [contractResult, clientResult] = await Promise.all([
      db('service_contracts').select('*').order('created_at', { ascending: false }),
      db('clients').select('id,full_name,phone,email,location,client_code').order('full_name'),
    ]);
    if (contractResult.error) toast.error(contractResult.error.message);
    if (clientResult.error) toast.error(clientResult.error.message);
    const nextContracts = contractResult.data || [];
    setContracts(nextContracts);
    setClients(clientResult.data || []);
    setSelectedId((current) => current && nextContracts.some((item: Row) => item.id === current) ? current : nextContracts[0]?.id || '');
    setLoading(false);
  }, []);

  const loadDetails = useCallback(async (contract: Row) => {
    const [siteResult, scheduleResult, visitResult, invoiceResult, bookingResult, pestResult] = await Promise.all([
      db('service_contract_sites').select('*').eq('contract_id', contract.id).order('site_name'),
      db('service_contract_schedules').select('*').eq('contract_id', contract.id).order('created_at', { ascending: false }),
      db('service_contract_visits').select('*').eq('contract_id', contract.id).order('scheduled_date', { ascending: false }),
      db('invoices').select('*').eq('client_id', contract.client_id).order('date', { ascending: false }).limit(500),
      db('bookings').select('id,booking_code,service_date,service_id,client_name,location,status,contract_id').eq('client_id', contract.client_id).order('service_date', { ascending: false }).limit(300),
      db('pest_jobs').select('id,job_number,service_date,pest_type,client_name,client_location,status,contract_id').eq('client_id', contract.client_id).order('service_date', { ascending: false }).limit(300),
    ]);
    for (const result of [siteResult, scheduleResult, visitResult, invoiceResult, bookingResult, pestResult]) {
      if (result.error) toast.error(result.error.message);
    }
    setSites(siteResult.data || []);
    setSchedules(scheduleResult.data || []);
    setVisits(visitResult.data || []);
    setClientInvoices(invoiceResult.data || []);
    setBookings(bookingResult.data || []);
    setPestJobs(pestResult.data || []);
    const invoiceIds = (invoiceResult.data || []).filter((item: Row) => item.contract_id === contract.id).map((item: Row) => item.id);
    if (invoiceIds.length) {
      const paymentResult = await db('invoice_payments').select('invoice_id,amount,approval_status').in('invoice_id', invoiceIds);
      if (paymentResult.error) toast.error(paymentResult.error.message);
      setPayments(paymentResult.data || []);
    } else setPayments([]);
  }, []);

  useEffect(() => { loadContracts(); }, [loadContracts]);
  useEffect(() => { if (selected) loadDetails(selected); }, [selectedId, contracts, loadDetails]);

  const contractInvoices = useMemo(() => clientInvoices.filter((item) => item.contract_id === selectedId && !['cancelled', 'void'].includes(item.payment_status)), [clientInvoices, selectedId]);
  const invoiced = contractInvoices.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const collected = payments.filter((item) => item.approval_status === 'approved').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const directCosts = visits.reduce((sum, item) => sum + Number(item.total_direct_cost || 0), 0);
  const outstanding = Math.max(0, invoiced - collected);
  const margin = invoiced - directCosts;

  const createContract = async () => {
    if (!user?.id) return toast.error('Your session is not available. Sign in again.');
    if (!contractForm.client_id || !contractForm.company_legal_name.trim() || !contractForm.scope_of_work.trim() || !contractForm.start_date) {
      return toast.error('Select a company client and enter the legal name, service scope and start date.');
    }
    if (!contractForm.pricing_model || !contractForm.billing_frequency) {
      return toast.error('Choose the agreed pricing method and billing frequency.');
    }
    const numeric = (value: string) => value.trim() === '' ? 0 : Number(value);
    const priceComponents = contractForm.pricing_model === 'fixed_monthly' ? [numeric(contractForm.fixed_monthly_fee)]
      : contractForm.pricing_model === 'per_visit' ? [numeric(contractForm.per_visit_rate)]
      : contractForm.pricing_model === 'per_sqm' ? [numeric(contractForm.per_sqm_rate)]
      : [numeric(contractForm.hybrid_fixed_fee), numeric(contractForm.hybrid_visit_rate), numeric(contractForm.hybrid_per_sqm_rate)];
    if (priceComponents.some((value) => !Number.isFinite(value) || value < 0) || priceComponents.every((value) => value === 0)) {
      return toast.error('Enter at least one positive, valid price component for the selected pricing method.');
    }
    setBusy(true);
    const { error } = await db('service_contracts').insert({
      ...contractForm,
      company_registration_number: contractForm.company_registration_number || null,
      billing_contact_name: contractForm.billing_contact_name || null,
      billing_email: contractForm.billing_email || null,
      billing_phone: contractForm.billing_phone || null,
      billing_address: contractForm.billing_address || null,
      end_date: contractForm.end_date || null,
      payment_terms_days: contractForm.payment_terms_days === '' ? null : Number(contractForm.payment_terms_days),
      renewal_notice_days: contractForm.renewal_notice_days === '' ? null : Number(contractForm.renewal_notice_days),
      fixed_monthly_fee: numeric(contractForm.fixed_monthly_fee),
      per_visit_rate: numeric(contractForm.per_visit_rate),
      per_sqm_rate: numeric(contractForm.per_sqm_rate),
      hybrid_fixed_fee: numeric(contractForm.hybrid_fixed_fee),
      hybrid_visit_rate: numeric(contractForm.hybrid_visit_rate),
      hybrid_per_sqm_rate: numeric(contractForm.hybrid_per_sqm_rate),
      status: 'draft', approval_status: 'pending_approval', created_by: user.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Contract submitted for independent approval');
    setContractOpen(false); setContractForm(emptyContract); await loadContracts();
  };

  const addSite = async () => {
    if (!selected || !siteForm.site_name.trim() || !siteForm.address.trim()) return toast.error('Enter the site name and address.');
    const { error } = await db('service_contract_sites').insert({
      ...siteForm, contract_id: selected.id, area_sqm: siteForm.area_sqm === '' ? null : Number(siteForm.area_sqm),
    });
    if (error) return toast.error(error.message);
    toast.success('Service location added'); setSiteOpen(false);
    setSiteForm({ site_name: '', address: '', contact_name: '', contact_phone: '', area_sqm: '', notes: '' });
    await loadDetails(selected);
  };

  const addSchedule = async () => {
    if (!selected || !user?.id || !scheduleForm.service_description.trim() || !scheduleForm.frequency || !scheduleForm.start_date) return toast.error('Enter the service description, schedule frequency and start date.');
    const { error } = await db('service_contract_schedules').insert({
      ...scheduleForm, contract_id: selected.id, site_id: scheduleForm.site_id || null,
      interval_count: Number(scheduleForm.interval_count || 1), visits_per_cycle: Number(scheduleForm.visits_per_cycle || 1),
      weekday: scheduleForm.weekday === '' ? null : Number(scheduleForm.weekday),
      end_date: scheduleForm.end_date || null, created_by: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success('Recurring service schedule saved'); setScheduleOpen(false);
    setScheduleForm({ site_id: '', service_description: '', frequency: '', interval_count: '1', visits_per_cycle: '1', weekday: '', preferred_time: '', start_date: '', end_date: '', notes: '' });
    await loadDetails(selected);
  };

  const addVisit = async () => {
    if (!selected || !user?.id || !visitForm.scheduled_date) return toast.error('Choose the planned service date.');
    if (visitForm.booking_id && visitForm.pest_job_id) return toast.error('Link either a cleaning booking or a pest-control job, not both.');
    const money = (value: string) => value.trim() === '' ? 0 : Number(value);
    const { error } = await db('service_contract_visits').insert({
      ...visitForm, contract_id: selected.id, site_id: visitForm.site_id || null,
      schedule_id: visitForm.schedule_id || null, booking_id: visitForm.booking_id || null,
      pest_job_id: visitForm.pest_job_id || null, fixed_staff_cost: money(visitForm.fixed_staff_cost),
      supplies_cost: money(visitForm.supplies_cost), transport_cost: money(visitForm.transport_cost),
      equipment_cost: money(visitForm.equipment_cost), other_cost: money(visitForm.other_cost),
      created_by: user.id,
    }).select('id').single();
    if (error) return toast.error(error.message);
    if (visitForm.booking_id) {
      const { error: linkError } = await db('bookings').update({ contract_id: selected.id, contract_site_id: visitForm.site_id || null }).eq('id', visitForm.booking_id);
      if (linkError) toast.error('Visit saved, but booking link failed: ' + linkError.message);
    }
    if (visitForm.pest_job_id) {
      const { error: linkError } = await db('pest_jobs').update({ contract_id: selected.id, contract_site_id: visitForm.site_id || null }).eq('id', visitForm.pest_job_id);
      if (linkError) toast.error('Visit saved, but pest-control job link failed: ' + linkError.message);
    }
    toast.success('Contract visit recorded');
    setVisitOpen(false);
    setVisitForm({ site_id: '', schedule_id: '', booking_id: '', pest_job_id: '', scheduled_date: today, fixed_staff_cost: '', supplies_cost: '', transport_cost: '', equipment_cost: '', other_cost: '', notes: '' });
    await loadDetails(selected);
  };

  const updateVisitStatus = async (visit: Row, status: string) => {
    const { error } = await db('service_contract_visits').update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', visit.id);
    if (error) return toast.error(error.message);
    if (selected) await loadDetails(selected);
  };

  const linkInvoice = async () => {
    if (!selected || !invoiceForm.invoice_id) return toast.error('Choose an invoice to link.');
    const { error } = await db('invoices').update({
      contract_id: selected.id, contract_site_id: invoiceForm.site_id || null,
    }).eq('id', invoiceForm.invoice_id).eq('client_id', selected.client_id);
    if (error) return toast.error(error.message);
    toast.success('Invoice linked to contract; existing payment and ledger records are unchanged.');
    setInvoiceOpen(false); setInvoiceForm({ invoice_id: '', site_id: '' }); await loadDetails(selected);
  };

  const decideContract = async (decision: 'approved' | 'rejected') => {
    if (!selected) return;
    const note = decision === 'rejected' ? window.prompt('Reason for rejecting this contract?') : null;
    if (decision === 'rejected' && !note?.trim()) return toast.error('A rejection reason is required.');
    setBusy(true);
    const { error } = await (supabase as any).rpc('commercial_contract_decide', {
      p_contract_id: selected.id, p_decision: decision, p_note: note,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(decision === 'approved' ? 'Contract approved and activated' : 'Contract returned for correction');
    await loadContracts();
  };

  const statusBadge = (status: string) => <Badge variant={status === 'active' || status === 'approved' || status === 'completed' ? 'default' : status === 'rejected' || status === 'terminated' ? 'destructive' : 'secondary'}>{String(status || 'unknown').replaceAll('_', ' ')}</Badge>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs text-muted-foreground">Commercial operations</p><h1 className="text-2xl font-bold tracking-tight">Commercial Contracts</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Manage company agreements, service locations, recurring cleaning schedules, visits, billing links and direct contract costs.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={loadContracts}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={() => setContractOpen(true)}><Plus className="mr-2 h-4 w-4" />New contract</Button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 p-4"><Building2 className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Company contracts</p><p className="text-xl font-semibold">{contracts.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><FileText className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Invoiced on selected contract</p><p className="text-lg font-semibold">{kes(invoiced)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><Wallet className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Approved collections</p><p className="text-lg font-semibold">{kes(collected)}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><CalendarDays className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Direct visit costs</p><p className="text-lg font-semibold">{kes(directCosts)}</p></div></CardContent></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,2fr)]">
        <Card><CardHeader><CardTitle className="text-base">Contracts</CardTitle></CardHeader><CardContent className="space-y-2">
          {loading ? <p className="text-sm text-muted-foreground">Loading contracts…</p> : contracts.length === 0 ? <p className="text-sm text-muted-foreground">No commercial contracts yet. Create the first company agreement.</p> : contracts.map((item) => {
            const company = clients.find((entry) => entry.id === item.client_id);
            return <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedId === item.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
              <div className="flex items-start justify-between gap-2"><span className="font-semibold">{item.company_legal_name}</span>{statusBadge(item.approval_status)}</div>
              <p className="mt-1 text-xs text-muted-foreground">{item.contract_number} · {company?.full_name || 'Linked company client'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.start_date}{item.end_date ? ' — ' + item.end_date : ' — ongoing'}</p>
            </button>;
          })}
        </CardContent></Card>

        <div className="min-w-0 space-y-4">
          {!selected ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Select a contract to view its operations and financial performance.</CardContent></Card> : <>
            <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{selected.company_legal_name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{selected.contract_number} · {selected.pricing_model.replaceAll('_', ' ')} · {selected.billing_frequency}</p></div><div className="flex flex-wrap items-center gap-2">{statusBadge(selected.status)}{statusBadge(selected.approval_status)}{selected.approval_status === 'pending_approval' && <><Button size="sm" disabled={busy} onClick={() => decideContract('approved')}><CheckCircle2 className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => decideContract('rejected')}>Reject</Button></>}</div></div></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Invoiced</p><p className="text-lg font-semibold">{kes(invoiced)}</p></div>
                <div><p className="text-xs text-muted-foreground">Collected (approved payments)</p><p className="text-lg font-semibold">{kes(collected)}</p></div>
                <div><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-lg font-semibold">{kes(outstanding)}</p></div>
                <div><p className="text-xs text-muted-foreground">Gross contribution*</p><p className="text-lg font-semibold">{kes(margin)}</p></div>
                <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">*Invoiced value less recorded direct visit costs. Collections are shown separately; this is not a cash-basis profit calculation.</p>
              </CardContent></Card>

            <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Service locations</CardTitle><Button size="sm" onClick={() => setSiteOpen(true)}><Plus className="mr-1 h-4 w-4" />Add location</Button></div></CardHeader><CardContent className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Location</TableHead><TableHead>Address</TableHead><TableHead>Contact</TableHead><TableHead className="text-right">Area (m²)</TableHead></TableRow></TableHeader><TableBody>{sites.map((site) => <TableRow key={site.id}><TableCell className="font-medium">{site.site_name}</TableCell><TableCell>{site.address}</TableCell><TableCell>{site.contact_name || '—'}<span className="block text-xs text-muted-foreground">{site.contact_phone || ''}</span></TableCell><TableCell className="text-right">{site.area_sqm ?? '—'}</TableCell></TableRow>)}{sites.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No service locations added.</TableCell></TableRow>}</TableBody></Table>
            </CardContent></Card>

            <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Recurring service schedules</CardTitle><Button size="sm" onClick={() => setScheduleOpen(true)}><Plus className="mr-1 h-4 w-4" />Add schedule</Button></div></CardHeader><CardContent className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Location</TableHead><TableHead>Frequency</TableHead><TableHead>Visits / cycle</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{schedules.map((item) => <TableRow key={item.id}><TableCell>{item.service_description}</TableCell><TableCell>{sites.find((site) => site.id === item.site_id)?.site_name || 'All sites'}</TableCell><TableCell className="capitalize">{item.frequency}</TableCell><TableCell>{item.visits_per_cycle}</TableCell><TableCell>{item.start_date}{item.end_date ? ' — ' + item.end_date : ''}</TableCell><TableCell>{statusBadge(item.status)}</TableCell></TableRow>)}{schedules.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No recurring schedules configured.</TableCell></TableRow>}</TableBody></Table>
            </CardContent></Card>

            <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Service visits & fixed costing</CardTitle><Button size="sm" onClick={() => setVisitOpen(true)}><Plus className="mr-1 h-4 w-4" />Record visit</Button></div></CardHeader><CardContent className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Location</TableHead><TableHead>Linked job</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Staff</TableHead><TableHead className="text-right">Other direct costs</TableHead><TableHead className="text-right">Total cost</TableHead></TableRow></TableHeader><TableBody>{visits.map((item) => <TableRow key={item.id}><TableCell>{item.scheduled_date}</TableCell><TableCell>{sites.find((site) => site.id === item.site_id)?.site_name || '—'}</TableCell><TableCell>{item.booking_id ? 'Cleaning booking' : item.pest_job_id ? 'Pest-control job' : 'Standalone visit'}</TableCell><TableCell><Select value={item.status} onValueChange={(value) => updateVisitStatus(item, value)}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="missed">Missed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></TableCell><TableCell className="text-right">{kes(item.fixed_staff_cost)}</TableCell><TableCell className="text-right">{kes(Number(item.supplies_cost || 0) + Number(item.transport_cost || 0) + Number(item.equipment_cost || 0) + Number(item.other_cost || 0))}</TableCell><TableCell className="text-right font-semibold">{kes(item.total_direct_cost)}</TableCell></TableRow>)}{visits.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No visits recorded yet.</TableCell>}</TableBody></Table>
            </CardContent></Card>

            <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Contract invoices</CardTitle><Button size="sm" variant="outline" onClick={() => setInvoiceOpen(true)}><Plus className="mr-1 h-4 w-4" />Link existing invoice</Button></div></CardHeader><CardContent className="overflow-x-auto">
              <Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Due date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{contractInvoices.map((item) => <TableRow key={item.id}><TableCell className="font-medium">{item.invoice_number}</TableCell><TableCell>{item.date}</TableCell><TableCell>{item.due_date || '—'}</TableCell><TableCell>{statusBadge(item.payment_status)}</TableCell><TableCell className="text-right">{kes(item.amount)}</TableCell></TableRow>)}{contractInvoices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No invoices linked. Link invoices created for this company client.</TableCell></TableRow>}</TableBody></Table>
            </CardContent></Card>
          </>}
        </div>
      </div>

      <Dialog open={contractOpen} onOpenChange={setContractOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Create commercial service contract</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Existing company client</Label><Select value={contractForm.client_id} onValueChange={(value) => { const item = clients.find((entry) => entry.id === value); setContractForm((form) => ({ ...form, client_id: value, company_legal_name: item?.full_name || form.company_legal_name, billing_email: item?.email || form.billing_email, billing_phone: item?.phone || form.billing_phone })); }}><SelectTrigger><SelectValue placeholder="Select company client from CRM" /></SelectTrigger><SelectContent>{clients.map((item) => <SelectItem key={item.id} value={item.id}>{item.full_name} · {item.phone}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Company legal name</Label><Input value={contractForm.company_legal_name} onChange={(e) => setContractForm((f) => ({ ...f, company_legal_name: e.target.value }))} /></div>
        <div><Label>Company registration number</Label><Input value={contractForm.company_registration_number} onChange={(e) => setContractForm((f) => ({ ...f, company_registration_number: e.target.value }))} /></div>
        <div><Label>Billing contact</Label><Input value={contractForm.billing_contact_name} onChange={(e) => setContractForm((f) => ({ ...f, billing_contact_name: e.target.value }))} /></div>
        <div><Label>Billing email</Label><Input type="email" value={contractForm.billing_email} onChange={(e) => setContractForm((f) => ({ ...f, billing_email: e.target.value }))} /></div>
        <div><Label>Billing phone</Label><Input value={contractForm.billing_phone} onChange={(e) => setContractForm((f) => ({ ...f, billing_phone: e.target.value }))} /></div>
        <div><Label>Billing address</Label><Input value={contractForm.billing_address} onChange={(e) => setContractForm((f) => ({ ...f, billing_address: e.target.value }))} /></div>
        <div className="sm:col-span-2"><Label>Contract scope / services</Label><Textarea value={contractForm.scope_of_work} onChange={(e) => setContractForm((f) => ({ ...f, scope_of_work: e.target.value }))} /></div>
        <div><Label>Pricing method</Label><Select value={contractForm.pricing_model} onValueChange={(value) => setContractForm((f) => ({ ...f, pricing_model: value }))}><SelectTrigger><SelectValue placeholder="Choose pricing method" /></SelectTrigger><SelectContent><SelectItem value="fixed_monthly">Fixed monthly retainer</SelectItem><SelectItem value="per_visit">Per cleaning visit</SelectItem><SelectItem value="per_sqm">Per square metre</SelectItem><SelectItem value="hybrid">Hybrid pricing</SelectItem></SelectContent></Select></div>
        <div><Label>Billing frequency</Label><Select value={contractForm.billing_frequency} onValueChange={(value) => setContractForm((f) => ({ ...f, billing_frequency: value }))}><SelectTrigger><SelectValue placeholder="Choose billing frequency" /></SelectTrigger><SelectContent><SelectItem value="per_visit">Per visit</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="annually">Annually</SelectItem></SelectContent></Select></div>
        {contractForm.pricing_model === 'fixed_monthly' && <div><Label>Monthly retainer (KES)</Label><Input type="number" min="0" value={contractForm.fixed_monthly_fee} onChange={(e) => setContractForm((f) => ({ ...f, fixed_monthly_fee: e.target.value }))} /></div>}
        {contractForm.pricing_model === 'per_visit' && <div><Label>Rate per visit (KES)</Label><Input type="number" min="0" value={contractForm.per_visit_rate} onChange={(e) => setContractForm((f) => ({ ...f, per_visit_rate: e.target.value }))} /></div>}
        {contractForm.pricing_model === 'per_sqm' && <div><Label>Rate per m² (KES)</Label><Input type="number" min="0" value={contractForm.per_sqm_rate} onChange={(e) => setContractForm((f) => ({ ...f, per_sqm_rate: e.target.value }))} /></div>}
        {contractForm.pricing_model === 'hybrid' && <><div><Label>Fixed component (KES)</Label><Input type="number" min="0" value={contractForm.hybrid_fixed_fee} onChange={(e) => setContractForm((f) => ({ ...f, hybrid_fixed_fee: e.target.value }))} /></div><div><Label>Per-visit component (KES)</Label><Input type="number" min="0" value={contractForm.hybrid_visit_rate} onChange={(e) => setContractForm((f) => ({ ...f, hybrid_visit_rate: e.target.value }))} /></div><div><Label>Per-m² component (KES)</Label><Input type="number" min="0" value={contractForm.hybrid_per_sqm_rate} onChange={(e) => setContractForm((f) => ({ ...f, hybrid_per_sqm_rate: e.target.value }))} /></div></>}
        <div><Label>Payment terms (days, optional)</Label><Input type="number" min="0" value={contractForm.payment_terms_days} onChange={(e) => setContractForm((f) => ({ ...f, payment_terms_days: e.target.value }))} placeholder="Leave blank if not agreed" /></div>
        <div><Label>Renewal notice (days, optional)</Label><Input type="number" min="0" value={contractForm.renewal_notice_days} onChange={(e) => setContractForm((f) => ({ ...f, renewal_notice_days: e.target.value }))} /></div>
        <div><Label>Start date</Label><Input type="date" value={contractForm.start_date} onChange={(e) => setContractForm((f) => ({ ...f, start_date: e.target.value }))} /></div>
        <div><Label>End date (optional)</Label><Input type="date" value={contractForm.end_date} onChange={(e) => setContractForm((f) => ({ ...f, end_date: e.target.value }))} /></div>
      </div><p className="text-xs text-muted-foreground">New contracts require independent approval before activation. VAT is not charged. Prices and terms are entered only when agreed with the company.</p><DialogFooter><Button variant="outline" onClick={() => setContractOpen(false)}>Cancel</Button><Button disabled={busy} onClick={createContract}>Submit for approval</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={siteOpen} onOpenChange={setSiteOpen}><DialogContent><DialogHeader><DialogTitle>Add service location</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Site / building name</Label><Input value={siteForm.site_name} onChange={(e) => setSiteForm((f) => ({ ...f, site_name: e.target.value }))} /></div><div><Label>Physical address</Label><Input value={siteForm.address} onChange={(e) => setSiteForm((f) => ({ ...f, address: e.target.value }))} /></div><div className="grid grid-cols-2 gap-2"><div><Label>Site contact</Label><Input value={siteForm.contact_name} onChange={(e) => setSiteForm((f) => ({ ...f, contact_name: e.target.value }))} /></div><div><Label>Contact phone</Label><Input value={siteForm.contact_phone} onChange={(e) => setSiteForm((f) => ({ ...f, contact_phone: e.target.value }))} /></div></div><div><Label>Area (m², optional)</Label><Input type="number" min="0" value={siteForm.area_sqm} onChange={(e) => setSiteForm((f) => ({ ...f, area_sqm: e.target.value }))} /></div><div><Label>Notes</Label><Textarea value={siteForm.notes} onChange={(e) => setSiteForm((f) => ({ ...f, notes: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setSiteOpen(false)}>Cancel</Button><Button onClick={addSite}>Save location</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Create recurring service schedule</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Service description</Label><Input value={scheduleForm.service_description} onChange={(e) => setScheduleForm((f) => ({ ...f, service_description: e.target.value }))} placeholder="e.g. Daily office cleaning" /></div><div><Label>Service location</Label><Select value={scheduleForm.site_id || 'all'} onValueChange={(v) => setScheduleForm((f) => ({ ...f, site_id: v === 'all' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All contract sites</SelectItem>{sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.site_name}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-2"><div><Label>Frequency</Label><Select value={scheduleForm.frequency} onValueChange={(v) => setScheduleForm((f) => ({ ...f, frequency: v }))}><SelectTrigger><SelectValue placeholder="Choose visit frequency" /></SelectTrigger><SelectContent>{['daily','weekly','biweekly','monthly','quarterly','custom'].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div><div><Label>Interval</Label><Input type="number" min="1" value={scheduleForm.interval_count} onChange={(e) => setScheduleForm((f) => ({ ...f, interval_count: e.target.value }))} /></div><div><Label>Visits per cycle</Label><Input type="number" min="1" value={scheduleForm.visits_per_cycle} onChange={(e) => setScheduleForm((f) => ({ ...f, visits_per_cycle: e.target.value }))} /></div><div><Label>Weekday (0 Sun–6 Sat)</Label><Input type="number" min="0" max="6" value={scheduleForm.weekday} onChange={(e) => setScheduleForm((f) => ({ ...f, weekday: e.target.value }))} /></div><div><Label>Preferred time</Label><Input value={scheduleForm.preferred_time} onChange={(e) => setScheduleForm((f) => ({ ...f, preferred_time: e.target.value }))} placeholder="Optional" /></div><div><Label>Start date</Label><Input type="date" value={scheduleForm.start_date} onChange={(e) => setScheduleForm((f) => ({ ...f, start_date: e.target.value }))} /></div><div><Label>End date</Label><Input type="date" value={scheduleForm.end_date} onChange={(e) => setScheduleForm((f) => ({ ...f, end_date: e.target.value }))} /></div></div><div><Label>Notes</Label><Textarea value={scheduleForm.notes} onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))} /></div></div><p className="text-xs text-muted-foreground">This stores the recurring schedule definition. Individual visits are recorded separately so actual completion and costs remain auditable.</p><DialogFooter><Button variant="outline" onClick={() => setScheduleOpen(false)}>Cancel</Button><Button onClick={addSchedule}>Save schedule</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={visitOpen} onOpenChange={setVisitOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Record contract service visit</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><div><Label>Scheduled date</Label><Input type="date" value={visitForm.scheduled_date} onChange={(e) => setVisitForm((f) => ({ ...f, scheduled_date: e.target.value }))} /></div><div><Label>Location</Label><Select value={visitForm.site_id || 'none'} onValueChange={(v) => setVisitForm((f) => ({ ...f, site_id: v === 'none' ? '' : v }))}><SelectTrigger><SelectValue placeholder="Choose site" /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem>{sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.site_name}</SelectItem>)}</SelectContent></Select></div><div className="sm:col-span-2"><Label>Recurring schedule (optional)</Label><Select value={visitForm.schedule_id || 'none'} onValueChange={(v) => setVisitForm((f) => ({ ...f, schedule_id: v === 'none' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Ad-hoc visit</SelectItem>{schedules.map((item) => <SelectItem key={item.id} value={item.id}>{item.service_description}</SelectItem>)}</SelectContent></Select></div><div><Label>Link cleaning booking (optional)</Label><Select value={visitForm.booking_id || 'none'} onValueChange={(v) => setVisitForm((f) => ({ ...f, booking_id: v === 'none' ? '' : v, pest_job_id: '' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No booking</SelectItem>{bookings.filter((item) => !item.contract_id || item.contract_id === selectedId).map((item) => <SelectItem key={item.id} value={item.id}>{item.booking_code || item.id.slice(0,8)} · {item.service_date} · {item.location}</SelectItem>)}</SelectContent></Select></div><div><Label>Link pest-control job (optional)</Label><Select value={visitForm.pest_job_id || 'none'} onValueChange={(v) => setVisitForm((f) => ({ ...f, pest_job_id: v === 'none' ? '' : v, booking_id: '' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No pest job</SelectItem>{pestJobs.filter((item) => !item.contract_id || item.contract_id === selectedId).map((item) => <SelectItem key={item.id} value={item.id}>{item.job_number || item.id.slice(0,8)} · {item.service_date} · {item.pest_type || 'Pest control'}</SelectItem>)}</SelectContent></Select></div><div><Label>Fixed staff cost (KES)</Label><Input type="number" min="0" value={visitForm.fixed_staff_cost} onChange={(e) => setVisitForm((f) => ({ ...f, fixed_staff_cost: e.target.value }))} /></div><div><Label>Supplies cost (KES)</Label><Input type="number" min="0" value={visitForm.supplies_cost} onChange={(e) => setVisitForm((f) => ({ ...f, supplies_cost: e.target.value }))} /></div><div><Label>Transport cost (KES)</Label><Input type="number" min="0" value={visitForm.transport_cost} onChange={(e) => setVisitForm((f) => ({ ...f, transport_cost: e.target.value }))} /></div><div><Label>Equipment cost (KES)</Label><Input type="number" min="0" value={visitForm.equipment_cost} onChange={(e) => setVisitForm((f) => ({ ...f, equipment_cost: e.target.value }))} /></div><div><Label>Other direct cost (KES)</Label><Input type="number" min="0" value={visitForm.other_cost} onChange={(e) => setVisitForm((f) => ({ ...f, other_cost: e.target.value }))} /></div><div className="sm:col-span-2"><Label>Visit notes</Label><Textarea value={visitForm.notes} onChange={(e) => setVisitForm((f) => ({ ...f, notes: e.target.value }))} /></div></div><p className="text-xs text-muted-foreground">Staff cost is entered as a fixed amount per visit. These cost allocations support contract profitability analysis and do not create or duplicate payroll or ledger entries.</p><DialogFooter><Button variant="outline" onClick={() => setVisitOpen(false)}>Cancel</Button><Button onClick={addVisit}>Save visit</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}><DialogContent><DialogHeader><DialogTitle>Link an existing company invoice</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Invoice</Label><Select value={invoiceForm.invoice_id} onValueChange={(v) => setInvoiceForm((f) => ({ ...f, invoice_id: v }))}><SelectTrigger><SelectValue placeholder="Choose an unlinked invoice" /></SelectTrigger><SelectContent>{clientInvoices.filter((item) => !item.contract_id || item.contract_id === selectedId).map((item) => <SelectItem key={item.id} value={item.id}>{item.invoice_number} · {item.date} · {kes(item.amount)}</SelectItem>)}</SelectContent></Select></div><div><Label>Service location (optional)</Label><Select value={invoiceForm.site_id || 'none'} onValueChange={(v) => setInvoiceForm((f) => ({ ...f, site_id: v === 'none' ? '' : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem>{sites.map((site) => <SelectItem key={site.id} value={site.id}>{site.site_name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancel</Button><Button onClick={linkInvoice}>Link invoice</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
