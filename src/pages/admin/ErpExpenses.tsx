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
import { toast } from '@/hooks/use-toast';

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
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
      date: form.date, amount: Number(form.amount), category: form.category, description: form.description || null, created_by: user!.id,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Expense recorded' });
    setOpen(false);
    setForm({ date: new Date().toISOString().split('T')[0], amount: '', category: 'other', description: '' });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    toast({ title: 'Expense deleted' });
    fetchData();
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
                <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {records.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No expenses recorded yet</TableCell></TableRow> :
                  records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell className="font-medium text-red-500">KES {Number(r.amount).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{r.category.replace(/_/g, ' ')}</TableCell>
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
