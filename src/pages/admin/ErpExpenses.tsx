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
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
  approval_status?: string;
  paid_at?: string | null;
}

const CATEGORIES = ['fuel', 'cleaning_chemicals', 'equipment', 'marketing', 'staff_payment', 'transport', 'utilities', 'rent', 'other'];

export default function ErpExpenses() {
  const { user } = useAuth();
  const [records, setRecords] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', category: 'other', description: '' });

  const fetchData = async () => {
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    setRecords((data || []) as Expense[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    const { error } = await supabase.from('expenses').insert({
      date: form.date, amount: Number(form.amount), category: form.category, description: form.description || null, created_by: user!.id, approval_status: 'pending_approval', payment_method: 'cash',
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Expense submitted for independent approval' });
    setOpen(false);
    setForm({ date: new Date().toISOString().split('T')[0], amount: '', category: 'other', description: '' });
    fetchData();
  };

  const decideExpense = async (id: string, decision: 'approved' | 'rejected') => {
    const note = decision === 'rejected' ? window.prompt('Reason for rejecting this expense:') : null;
    if (decision === 'rejected' && !note?.trim()) return;
    const { data: approval } = await (supabase.from('accounting_approvals').select('id') as any)
      .eq('entity_type', 'expense').eq('entity_id', id).eq('status', 'pending_approval').maybeSingle();
    if (!approval?.id) return toast({ title: 'Approval request not found', variant: 'destructive' });
    const { error } = await (supabase as any).rpc('accounting_decide_approval', {
      p_approval_id: approval.id, p_decision: decision, p_note: note?.trim() || null,
    });
    if (error) toast({ title: 'Approval failed', description: error.message, variant: 'destructive' });
    else toast({ title: decision === 'approved' ? 'Expense approved' : 'Expense rejected' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const record = records.find((item) => item.id === id);
    if (!record || record.approval_status !== 'rejected') return toast({ title: 'Only rejected expenses can be deleted', variant: 'destructive' });
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) return toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Rejected expense deleted' }); fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expense Tracking</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Record Expense</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><Label>Amount (KES)</Label><Input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              </div>
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <Button className="w-full" onClick={handleSubmit}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center p-8"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Approval</TableHead><TableHead>Payment</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {records.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No expenses recorded yet</TableCell></TableRow> :
                  records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell className="font-medium text-red-500">KES {Number(r.amount).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{r.category.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.description || '—'}</TableCell>
                      <TableCell><Badge variant={r.approval_status === 'approved' ? 'default' : r.approval_status === 'rejected' ? 'destructive' : 'secondary'}>{r.approval_status || 'pending approval'}</Badge></TableCell>
                      <TableCell>{r.paid_at ? 'Paid' : 'Unpaid'}</TableCell>
                      <TableCell><div className="flex gap-1">
                        {r.approval_status === 'pending_approval' && <><Button size="sm" variant="outline" onClick={() => decideExpense(r.id,'approved')}>Approve</Button><Button size="sm" variant="ghost" onClick={() => decideExpense(r.id,'rejected')}>Reject</Button></>}
                        {r.approval_status === 'rejected' && <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </div></TableCell>
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
