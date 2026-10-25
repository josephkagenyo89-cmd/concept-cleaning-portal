import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Wallet, ReceiptText, RefreshCw, Banknote } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  created_at: string;
  supplier_name?: string | null;
  receipt_reference?: string | null;
  payment_method?: string;
  approval_status?: string;
}

interface PettyCashFund {
  fund_id: string;
  name: string;
  custodian_id: string | null;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
}

interface PettyCashTransaction {
  id: string;
  fund_id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  description: string;
  reference: string | null;
  expense_id: string | null;
  receipt_reference: string | null;
  status: string;
}

const CATEGORIES = ['fuel', 'cleaning_chemicals', 'equipment', 'marketing', 'staff_payment', 'transport', 'utilities', 'rent', 'other'];
const MOVEMENT_TYPES = [
  { value: 'replenishment', label: 'Replenishment (cash added)' },
  { value: 'cash_return', label: 'Cash returned (cash added)' },
  { value: 'adjustment_in', label: 'Adjustment in (cash added)' },
  { value: 'adjustment_out', label: 'Adjustment out (cash removed)' },
];

const today = () => new Date().toISOString().split('T')[0];
const money = (value: number | string | null | undefined) =>
  `KES ${Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ErpExpenses() {
  const { user } = useAuth();
  const [records, setRecords] = useState<Expense[]>([]);
  const [funds, setFunds] = useState<PettyCashFund[]>([]);
  const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [pettyExpenseOpen, setPettyExpenseOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    date: today(), amount: '', category: 'other', description: '', supplier_name: '', receipt_reference: '', receipt_url: '', payment_method: 'cash',
  });
  const [fundForm, setFundForm] = useState({ name: '', opening_balance: '0', notes: '' });
  const [pettyExpenseForm, setPettyExpenseForm] = useState({
    fund_id: '', date: today(), amount: '', category: 'other', description: '', supplier_name: '', receipt_reference: '', receipt_url: '',
  });
  const [movementForm, setMovementForm] = useState({
    fund_id: '', date: today(), transaction_type: 'replenishment', amount: '', description: '', reference: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [expenseRes, fundRes, transactionRes] = await Promise.all([
      supabase.from('expenses').select('id,date,amount,category,description,created_at,supplier_name,receipt_reference,payment_method,approval_status').order('date', { ascending: false }),
      (supabase as any).from('petty_cash_fund_balances').select('*').order('name'),
      (supabase as any).from('petty_cash_transactions').select('id,fund_id,transaction_date,transaction_type,amount,description,reference,expense_id,receipt_reference,status').order('transaction_date', { ascending: false }).limit(200),
    ]);
    if (expenseRes.error) toast({ title: 'Could not load expenses', description: expenseRes.error.message, variant: 'destructive' });
    if (fundRes.error && !fundRes.error.message.includes('does not exist')) {
      toast({ title: 'Could not load petty-cash funds', description: fundRes.error.message, variant: 'destructive' });
    }
    if (transactionRes.error && !transactionRes.error.message.includes('does not exist')) {
      toast({ title: 'Could not load petty-cash cashbook', description: transactionRes.error.message, variant: 'destructive' });
    }
    setRecords((expenseRes.data || []) as Expense[]);
    setFunds((fundRes.data || []) as PettyCashFund[]);
    setTransactions((transactionRes.data || []) as PettyCashTransaction[]);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleExpenseSubmit = async () => {
    if (!user?.id || !expenseForm.amount || Number(expenseForm.amount) <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' }); return;
    }
    setSaving(true);
    const { error } = await supabase.from('expenses').insert({
      date: expenseForm.date,
      amount: Number(expenseForm.amount),
      category: expenseForm.category,
      description: expenseForm.description || null,
      supplier_name: expenseForm.supplier_name || null,
      receipt_reference: expenseForm.receipt_reference || null,
      receipt_url: expenseForm.receipt_url || null,
      payment_method: expenseForm.payment_method,
      approval_status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      paid_by: user.id,
      paid_at: new Date().toISOString(),
      created_by: user.id,
    } as any);
    setSaving(false);
    if (error) { toast({ title: 'Could not save expense', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Expense recorded' });
    setExpenseOpen(false);
    setExpenseForm({ date: today(), amount: '', category: 'other', description: '', supplier_name: '', receipt_reference: '', receipt_url: '', payment_method: 'cash' });
    await fetchData();
  };

  const handleCreateFund = async () => {
    if (!user?.id || !fundForm.name.trim() || Number(fundForm.opening_balance) < 0) {
      toast({ title: 'Enter a fund name and valid opening balance', variant: 'destructive' }); return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from('petty_cash_funds').insert({
      name: fundForm.name.trim(), opening_balance: Number(fundForm.opening_balance), notes: fundForm.notes || null, created_by: user.id,
    });
    setSaving(false);
    if (error) { toast({ title: 'Could not create petty-cash fund', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Petty-cash fund created' });
    setFundOpen(false);
    setFundForm({ name: '', opening_balance: '0', notes: '' });
    await fetchData();
  };

  const handlePettyExpense = async () => {
    if (!pettyExpenseForm.fund_id || !pettyExpenseForm.amount || Number(pettyExpenseForm.amount) <= 0 || !pettyExpenseForm.description.trim()) {
      toast({ title: 'Select a fund and enter the amount and description', variant: 'destructive' }); return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any).rpc('accounting_record_petty_cash_expense', {
      p_fund_id: pettyExpenseForm.fund_id,
      p_date: pettyExpenseForm.date,
      p_amount: Number(pettyExpenseForm.amount),
      p_category: pettyExpenseForm.category,
      p_description: pettyExpenseForm.description,
      p_receipt_reference: pettyExpenseForm.receipt_reference || null,
      p_receipt_url: pettyExpenseForm.receipt_url || null,
      p_supplier_name: pettyExpenseForm.supplier_name || null,
    });
    setSaving(false);
    if (error) { toast({ title: 'Could not record petty-cash expense', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Petty-cash expense recorded', description: `Expense ID: ${String(data).slice(0, 8)}` });
    setPettyExpenseOpen(false);
    setPettyExpenseForm({ fund_id: '', date: today(), amount: '', category: 'other', description: '', supplier_name: '', receipt_reference: '', receipt_url: '' });
    await fetchData();
  };

  const handleMovement = async () => {
    if (!movementForm.fund_id || !movementForm.amount || Number(movementForm.amount) <= 0 || !movementForm.description.trim()) {
      toast({ title: 'Select a fund and enter the amount and description', variant: 'destructive' }); return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc('accounting_record_petty_cash_movement', {
      p_fund_id: movementForm.fund_id,
      p_date: movementForm.date,
      p_type: movementForm.transaction_type,
      p_amount: Number(movementForm.amount),
      p_description: movementForm.description,
      p_reference: movementForm.reference || null,
    });
    setSaving(false);
    if (error) { toast({ title: 'Could not record cash movement', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Petty-cash movement recorded' });
    setMovementOpen(false);
    setMovementForm({ fund_id: '', date: today(), transaction_type: 'replenishment', amount: '', description: '', reference: '' });
    await fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense? Only delete entries created in error; keep supporting records for audit.')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { toast({ title: 'Could not delete expense', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Expense deleted' });
    await fetchData();
  };

  const fundName = (id: string) => funds.find(f => f.fund_id === id)?.name || 'Unknown fund';
  const signedMovement = (t: PettyCashTransaction) => {
    if (t.status !== 'approved') return 0;
    return ['replenishment', 'cash_return', 'adjustment_in'].includes(t.transaction_type) ? Number(t.amount) :
      ['expense', 'adjustment_out'].includes(t.transaction_type) ? -Number(t.amount) : 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses & Petty Cash</h1>
          <p className="text-sm text-muted-foreground">One expense register with a linked petty-cash cashbook. Petty-cash expenses are recorded once and linked to the same expense record.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />Record Expense</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date</Label><Input type="date" value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} /></div>
                  <div><Label>Amount (KES)</Label><Input type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))} /></div>
                </div>
                <div><Label>Category</Label><Select value={expenseForm.category} onValueChange={v => setExpenseForm(f => ({ ...f, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Paid via</Label><Select value={expenseForm.payment_method} onValueChange={v => setExpenseForm(f => ({ ...f, payment_method: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="mpesa">M-Pesa</SelectItem><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                <div><Label>Supplier / Payee</Label><Input value={expenseForm.supplier_name} onChange={e => setExpenseForm(f => ({ ...f, supplier_name: e.target.value }))} /></div>
                <div><Label>Description</Label><Textarea value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Receipt / Voucher No.</Label><Input value={expenseForm.receipt_reference} onChange={e => setExpenseForm(f => ({ ...f, receipt_reference: e.target.value }))} /></div>
                  <div><Label>Receipt URL (optional)</Label><Input type="url" value={expenseForm.receipt_url} onChange={e => setExpenseForm(f => ({ ...f, receipt_url: e.target.value }))} /></div>
                </div>
                <Button className="w-full" onClick={handleExpenseSubmit} disabled={saving}>{saving ? 'Saving…' : 'Save Expense'}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={fundOpen} onOpenChange={setFundOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New Petty-Cash Fund</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Petty-Cash Fund</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Fund name</Label><Input placeholder="e.g. Office Petty Cash" value={fundForm.name} onChange={e => setFundForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Opening cash balance (KES)</Label><Input type="number" min="0" step="0.01" value={fundForm.opening_balance} onChange={e => setFundForm(f => ({ ...f, opening_balance: e.target.value }))} /></div>
                <div><Label>Notes</Label><Textarea value={fundForm.notes} onChange={e => setFundForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button className="w-full" onClick={handleCreateFund} disabled={saving}>{saving ? 'Saving…' : 'Create Fund'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="expenses" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="expenses"><ReceiptText className="mr-2 h-4 w-4" />Expense Register</TabsTrigger>
          <TabsTrigger value="petty-cash"><Wallet className="mr-2 h-4 w-4" />Petty Cash</TabsTrigger>
          <TabsTrigger value="cashbook"><Banknote className="mr-2 h-4 w-4" />Cashbook</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Recorded expenses</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{records.length}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total recorded</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{money(records.reduce((sum, r) => sum + Number(r.amount), 0))}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">With receipt reference</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{records.filter(r => !!r.receipt_reference).length}</p></CardContent></Card>
          </div>
          <Card><CardContent className="p-0">
            {loading ? <div className="p-8 text-center text-muted-foreground">Loading expenses…</div> : <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Payee / Description</TableHead><TableHead>Category</TableHead><TableHead>Payment</TableHead><TableHead>Receipt</TableHead><TableHead className="text-right">Amount</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{records.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No expenses recorded yet</TableCell></TableRow> : records.map(r => <TableRow key={r.id}>
                <TableCell>{r.date}</TableCell>
                <TableCell><div className="font-medium">{r.supplier_name || r.description || 'Expense'}</div>{r.supplier_name && r.description && <div className="max-w-[240px] truncate text-xs text-muted-foreground">{r.description}</div>}</TableCell>
                <TableCell className="capitalize">{(r.category || 'other').replace(/_/g, ' ')}</TableCell>
                <TableCell className="capitalize">{(r.payment_method || 'cash').replace(/_/g, ' ')}</TableCell>
                <TableCell>{r.receipt_reference || '—'}</TableCell>
                <TableCell className="text-right font-medium">{money(r.amount)}</TableCell>
                <TableCell><Button variant="ghost" size="icon" onClick={() => void handleDelete(r.id)} aria-label="Delete expense"><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
              </TableRow>)}</TableBody>
            </Table>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="petty-cash" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Fund balances include approved opening balances and movements only. Spending below zero is blocked.</p>
            <div className="flex gap-2">
              <Dialog open={pettyExpenseOpen} onOpenChange={setPettyExpenseOpen}>
                <DialogTrigger asChild><Button disabled={!funds.some(f => f.is_active)}><Plus className="mr-2 h-4 w-4" />Record Petty-Cash Expense</Button></DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Petty-Cash Expense Voucher</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Fund</Label><Select value={pettyExpenseForm.fund_id} onValueChange={v => setPettyExpenseForm(f => ({ ...f, fund_id: v }))}><SelectTrigger><SelectValue placeholder="Choose fund" /></SelectTrigger><SelectContent>{funds.filter(f => f.is_active).map(f => <SelectItem key={f.fund_id} value={f.fund_id}>{f.name} — {money(f.current_balance)}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid grid-cols-2 gap-3"><div><Label>Date</Label><Input type="date" value={pettyExpenseForm.date} onChange={e => setPettyExpenseForm(f => ({ ...f, date: e.target.value }))} /></div><div><Label>Amount (KES)</Label><Input type="number" min="0.01" step="0.01" value={pettyExpenseForm.amount} onChange={e => setPettyExpenseForm(f => ({ ...f, amount: e.target.value }))} /></div></div>
                    <div><Label>Category</Label><Select value={pettyExpenseForm.category} onValueChange={v => setPettyExpenseForm(f => ({ ...f, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Payee / Supplier</Label><Input value={pettyExpenseForm.supplier_name} onChange={e => setPettyExpenseForm(f => ({ ...f, supplier_name: e.target.value }))} /></div>
                    <div><Label>Description / Purpose</Label><Textarea value={pettyExpenseForm.description} onChange={e => setPettyExpenseForm(f => ({ ...f, description: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3"><div><Label>Receipt / Voucher No.</Label><Input value={pettyExpenseForm.receipt_reference} onChange={e => setPettyExpenseForm(f => ({ ...f, receipt_reference: e.target.value }))} /></div><div><Label>Receipt URL (optional)</Label><Input type="url" value={pettyExpenseForm.receipt_url} onChange={e => setPettyExpenseForm(f => ({ ...f, receipt_url: e.target.value }))} /></div></div>
                    <Button className="w-full" onClick={handlePettyExpense} disabled={saving}>{saving ? 'Saving…' : 'Save Voucher & Expense'}</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
                <DialogTrigger asChild><Button variant="outline" disabled={!funds.some(f => f.is_active)}><RefreshCw className="mr-2 h-4 w-4" />Add / Return Cash</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Petty-Cash Movement</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Fund</Label><Select value={movementForm.fund_id} onValueChange={v => setMovementForm(f => ({ ...f, fund_id: v }))}><SelectTrigger><SelectValue placeholder="Choose fund" /></SelectTrigger><SelectContent>{funds.filter(f => f.is_active).map(f => <SelectItem key={f.fund_id} value={f.fund_id}>{f.name} — {money(f.current_balance)}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Movement</Label><Select value={movementForm.transaction_type} onValueChange={v => setMovementForm(f => ({ ...f, transaction_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MOVEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid grid-cols-2 gap-3"><div><Label>Date</Label><Input type="date" value={movementForm.date} onChange={e => setMovementForm(f => ({ ...f, date: e.target.value }))} /></div><div><Label>Amount (KES)</Label><Input type="number" min="0.01" step="0.01" value={movementForm.amount} onChange={e => setMovementForm(f => ({ ...f, amount: e.target.value }))} /></div></div>
                    <div><Label>Description</Label><Textarea value={movementForm.description} onChange={e => setMovementForm(f => ({ ...f, description: e.target.value }))} /></div>
                    <div><Label>Reference</Label><Input value={movementForm.reference} onChange={e => setMovementForm(f => ({ ...f, reference: e.target.value }))} /></div>
                    <Button className="w-full" onClick={handleMovement} disabled={saving}>{saving ? 'Saving…' : 'Save Movement'}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {funds.length === 0 && !loading && <Card><CardContent className="py-8 text-center text-muted-foreground">No petty-cash funds yet. Create a fund to begin tracking cash.</CardContent></Card>}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{funds.map(f => <Card key={f.fund_id}><CardHeader className="pb-2"><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{f.name}</CardTitle><Badge variant={f.is_active ? 'default' : 'secondary'}>{f.is_active ? 'Active' : 'Inactive'}</Badge></div></CardHeader><CardContent><p className="text-2xl font-bold">{money(f.current_balance)}</p><p className="text-xs text-muted-foreground">Opening balance: {money(f.opening_balance)}</p><p className="mt-2 text-xs text-muted-foreground">Custodian: {f.custodian_id ? 'Assigned user' : 'Not assigned'}</p></CardContent></Card>)}</div>
        </TabsContent>

        <TabsContent value="cashbook" className="space-y-4">
          <div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Recent 200 petty-cash movements. Expense vouchers link back to the existing expense register.</p><Button variant="outline" size="sm" onClick={() => void fetchData()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
          <Card><CardContent className="p-0">{loading ? <div className="p-8 text-center text-muted-foreground">Loading cashbook…</div> : <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Fund</TableHead><TableHead>Type</TableHead><TableHead>Description / Reference</TableHead><TableHead className="text-right">Movement</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
            <TableBody>{transactions.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No cashbook movements recorded yet</TableCell></TableRow> : transactions.map(t => <TableRow key={t.id}>
              <TableCell>{t.transaction_date}</TableCell><TableCell>{fundName(t.fund_id)}</TableCell><TableCell className="capitalize">{t.transaction_type.replace(/_/g, ' ')}</TableCell>
              <TableCell><div>{t.description}</div><div className="text-xs text-muted-foreground">{t.receipt_reference || t.reference || (t.expense_id ? `Expense ${t.expense_id.slice(0, 8)}` : '—')}</div></TableCell>
              <TableCell className={`text-right font-medium ${signedMovement(t) < 0 ? 'text-red-600' : 'text-green-700'}`}>{signedMovement(t) < 0 ? '−' : '+'}{money(Math.abs(signedMovement(t)))}</TableCell>
              <TableCell className="text-right"><Badge variant={t.status === 'approved' ? 'default' : 'secondary'}>{t.status.replace(/_/g, ' ')}</Badge></TableCell>
            </TableRow>)}</TableBody>
          </Table>}</CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
