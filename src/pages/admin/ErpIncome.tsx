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
import { Plus, Trash2, FileText, Filter } from 'lucide-react';
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
  created_at: string;
}

const SOURCES = ['client_payment', 'service_booking', 'other'];
const PAYMENT_METHODS = ['cash', 'mpesa', 'bank_transfer', 'cheque', 'other'];

export default function ErpIncome() {
  const { user } = useAuth();
  const [records, setRecords] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', description: '', service: '', payment_method: 'mpesa', source: 'client_payment' });

  // Filters
  const [filterSource, setFilterSource] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const fetchRecords = async () => {
    let query = supabase.from('income_records').select('*').order('date', { ascending: false });
    if (filterSource !== 'all') query = query.eq('source', filterSource);
    if (filterDateFrom) query = query.gte('date', filterDateFrom);
    if (filterDateTo) query = query.lte('date', filterDateTo);
    const { data } = await query;
    setRecords((data || []) as IncomeRecord[]);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [filterSource, filterDateFrom, filterDateTo]);

  const handleSubmit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    const { error } = await supabase.from('income_records').insert({
      date: form.date, amount: Number(form.amount), description: form.description || null,
      service: form.service || null, payment_method: form.payment_method, source: form.source, created_by: user!.id,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Income recorded' });
    setOpen(false);
    setForm({ date: new Date().toISOString().split('T')[0], amount: '', description: '', service: '', payment_method: 'mpesa', source: 'client_payment' });
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('income_records').delete().eq('id', id);
    toast({ title: 'Record deleted' });
    fetchRecords();
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
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" className="h-8 text-xs w-[130px]" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" className="h-8 text-xs w-[130px]" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            {(filterSource !== 'all' || filterDateFrom || filterDateTo) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFilterSource('all'); setFilterDateFrom(''); setFilterDateTo(''); }}>Clear</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center p-8"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Source</TableHead><TableHead>Method</TableHead><TableHead>Description</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {records.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No income records yet</TableCell></TableRow> :
                  records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell className="font-medium text-green-600">KES {Number(r.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <span className="capitalize">{r.source.replace(/_/g, ' ')}</span>
                        {r.invoice_id && <Badge variant="outline" className="ml-1 text-[10px]"><FileText className="h-3 w-3 mr-0.5" />Invoice</Badge>}
                      </TableCell>
                      <TableCell className="capitalize">{r.payment_method.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.description || '—'}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
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
