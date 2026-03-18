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
import { Plus, Trash2, FileText, Filter, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface IncomeRecord {
  id: string;
  date: string;
  amount: number;
  description: string | null;
  service: string | null;
  payment_method: string;
  source: string;
  invoice_id: string | null;
  status: string;
  mpesa_code: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

const SOURCES = ['client_payment', 'service_booking', 'other'];
const PAYMENT_METHODS = ['cash', 'mpesa', 'bank_transfer', 'cheque', 'other'];
const STATUS_OPTIONS = ['all', 'pending_approval', 'approved', 'rejected'];

export default function ErpIncome() {
  const { user, isSuperAdmin } = useAuth();
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', description: '', service: '', payment_method: 'mpesa', source: 'client_payment' });

  // Filters
  const [filterSource, setFilterSource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Approval dialog
  const [approvalRecord, setApprovalRecord] = useState<IncomeRecord | null>(null);
  const [mpesaCode, setMpesaCode] = useState('');
  const [approving, setApproving] = useState(false);

  const fetchRecords = async () => {
    let query = supabase.from('income_records').select('*').order('date', { ascending: false });
    if (filterSource !== 'all') query = query.eq('source', filterSource);
    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    if (filterDateFrom) query = query.gte('date', filterDateFrom);
    if (filterDateTo) query = query.lte('date', filterDateTo);
    const { data } = await query;
    setRecords((data || []) as IncomeRecord[]);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [filterSource, filterStatus, filterDateFrom, filterDateTo]);

  const handleSubmit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    const { error } = await supabase.from('income_records').insert({
      date: form.date, amount: Number(form.amount), description: form.description || null,
      service: form.service || null, payment_method: form.payment_method, source: form.source,
      created_by: user!.id, status: 'pending_approval',
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Income recorded — pending Super Admin approval' });
    setOpen(false);
    setForm({ date: new Date().toISOString().split('T')[0], amount: '', description: '', service: '', payment_method: 'mpesa', source: 'client_payment' });
    fetchRecords();
  };

  const handleApprove = async () => {
    if (!approvalRecord || !mpesaCode.trim()) {
      toast({ title: 'M-Pesa code is required', variant: 'destructive' });
      return;
    }
    setApproving(true);
    // Check for duplicate M-Pesa code
    const { data: dup } = await (supabase.from('income_records').select('id') as any)
      .eq('mpesa_code', mpesaCode.trim())
      .neq('id', approvalRecord.id)
      .maybeSingle();
    if (dup) {
      toast({ title: 'This M-Pesa code has already been used', variant: 'destructive' });
      setApproving(false);
      return;
    }
    const { error } = await supabase.from('income_records').update({
      status: 'approved',
      mpesa_code: mpesaCode.trim(),
      approved_by: user!.id,
      approved_at: new Date().toISOString(),
    } as any).eq('id', approvalRecord.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Income approved ✓' }); }
    setApproving(false);
    setApprovalRecord(null);
    setMpesaCode('');
    fetchRecords();
  };

  const handleReject = async (id: string) => {
    await supabase.from('income_records').update({ status: 'rejected' } as any).eq('id', id);
    toast({ title: 'Income record rejected' });
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('income_records').delete().eq('id', id);
    toast({ title: 'Record deleted' });
    fetchRecords();
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'approved': return <Badge className="bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Income Tracking</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Record Income</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Income</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><Label>Amount (KES)</Label><Input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              </div>
              <div><Label>Source</Label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Service (optional)</Label><Input value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <p className="text-xs text-muted-foreground">This record will require Super Admin approval with M-Pesa code before being finalized.</p>
              <Button className="w-full" onClick={handleSubmit}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground"><Filter className="h-4 w-4" /> Filters</div>
            <div className="min-w-[140px]">
              <Label className="text-xs">Source</Label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {SOURCES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[140px]">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-8 text-xs w-[130px]" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-8 text-xs w-[130px]" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            {(filterSource !== 'all' || filterStatus !== 'all' || filterDateFrom || filterDateTo) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterSource('all'); setFilterStatus('all'); setFilterDateFrom(''); setFilterDateTo(''); }}>Clear</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center p-8"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Source</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>M-Pesa Code</TableHead><TableHead>Description</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {records.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No income records yet</TableCell></TableRow> :
                  records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell className="font-medium text-green-600">KES {Number(r.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <span className="capitalize">{r.source.replace(/_/g, ' ')}</span>
                        {r.invoice_id && <Badge variant="outline" className="ml-1 text-[10px]"><FileText className="h-3 w-3 mr-0.5" />Invoice</Badge>}
                      </TableCell>
                      <TableCell className="capitalize">{r.payment_method.replace(/_/g, ' ')}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.mpesa_code || '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.description || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {r.status === 'pending_approval' && isSuperAdmin && (
                            <>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setApprovalRecord(r); setMpesaCode(''); }}>
                                <CheckCircle className="h-3 w-3 mr-1" />Approve
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleReject(r.id)}>
                                <XCircle className="h-3 w-3 mr-1" />Reject
                              </Button>
                            </>
                          )}
                          {r.status !== 'approved' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Approval Dialog */}
      <Dialog open={!!approvalRecord} onOpenChange={v => { if (!v) setApprovalRecord(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Income Record</DialogTitle></DialogHeader>
          {approvalRecord && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p><span className="font-medium">Amount:</span> KES {Number(approvalRecord.amount).toLocaleString()}</p>
                <p><span className="font-medium">Date:</span> {approvalRecord.date}</p>
                <p><span className="font-medium">Description:</span> {approvalRecord.description || '—'}</p>
                {approvalRecord.service && <p><span className="font-medium">Service:</span> {approvalRecord.service}</p>}
              </div>
              <div>
                <Label>M-Pesa Transaction Code *</Label>
                <Input
                  placeholder="e.g. SLK4H7J2XR"
                  value={mpesaCode}
                  onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">Enter the unique M-Pesa code to verify this payment.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApprovalRecord(null)}>Cancel</Button>
                <Button onClick={handleApprove} disabled={approving || !mpesaCode.trim()}>
                  {approving ? 'Verifying…' : 'Approve & Save'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
