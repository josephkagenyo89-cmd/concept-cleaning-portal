import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, CheckCircle2, Download, FileText, RefreshCw, Pencil, Banknote, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { computePay, downloadCsv, kes, MONTHS, payslipPdf, runStatusClass, type Line, type PayrollItem, type PayrollRun } from '@/lib/payroll';
import { generatePayrollItems, recalcRunTotals } from './HrPayroll';

export default function HrPayrollRun() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [edit, setEdit] = useState<PayrollItem | null>(null);
  const [adj, setAdj] = useState({ bonus: '', overtime: '', deduction: '', note: '' });
  const [confirm, setConfirm] = useState<'approve' | 'paid' | 'cancel' | null>(null);
  const [payRef, setPayRef] = useState('');

  const load = async () => {
    if (!id) return;
    const [r, i] = await Promise.all([
      supabase.from('payroll_runs').select('*').eq('id', id).maybeSingle(),
      supabase.from('payroll_items').select('*').eq('payroll_run_id', id).order('employee_name'),
    ]);
    setRun(r.data); setItems(i.data || []);
  };
  useEffect(() => { load(); }, [id]);
  if (!run) return <div className="flex justify-center p-12"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div>;
  const draft = run.status === 'draft';

  const regenerate = async () => {
    try { const n = await generatePayrollItems(run.id); toast.success(`Recalculated ${n} employees`); load(); }
    catch (e: any) { toast.error(e.message); }
  };

  const openEdit = (it: PayrollItem) => {
    const oneOff = ((it.deductions_breakdown as unknown as Line[]) || []).find((d) => d.name === 'One-off Deduction')?.amount || 0;
    setAdj({ bonus: String(it.bonus || ''), overtime: String(it.overtime || ''), deduction: oneOff ? String(oneOff) : '', note: it.adjustment_note || '' });
    setEdit(it);
  };

  const saveAdj = async () => {
    if (!edit) return;
    const earn = ((edit.earnings_breakdown as unknown as Line[]) || []).filter((e) => !['Basic Salary', 'Overtime', 'Bonus'].includes(e.name));
    const ded = ((edit.deductions_breakdown as unknown as Line[]) || []).filter((d) => !['PAYE', 'NSSF Tier I', 'NSSF Tier II', 'SHIF', 'Housing Levy', 'One-off Deduction'].includes(d.name));
    const { data: comp } = await supabase.from('employee_compensation').select('*').eq('employee_id', edit.employee_id).maybeSingle();
    const { data: parts } = await supabase.from('employee_pay_components').select('name,is_taxable').eq('employee_id', edit.employee_id);
    const pay = computePay({
      basic: Number(edit.basic_salary),
      allowances: earn.map((e) => ({ ...e, taxable: parts?.find((p) => p.name === e.name)?.is_taxable ?? true })),
      deductions: ded,
      bonus: Number(adj.bonus || 0), overtime: Number(adj.overtime || 0), oneOffDeduction: Number(adj.deduction || 0),
      exempt: comp ? { nssf: comp.nssf_exempt, shif: comp.shif_exempt, housing: comp.housing_levy_exempt, paye: comp.paye_exempt } : {},
    });
    const { error } = await supabase.from('payroll_items').update({
      ...pay, earnings_breakdown: pay.earnings_breakdown as any, deductions_breakdown: pay.deductions_breakdown as any, adjustment_note: adj.note || null,
    }).eq('id', edit.id);
    if (error) return toast.error(error.message);
    await recalcRunTotals(run.id);
    setEdit(null); toast.success('Adjustment saved'); load();
  };

  const transition = async () => {
    const patch: any = confirm === 'approve' ? { status: 'approved', approved_by_name: (profile as any)?.full_name || null }
      : confirm === 'paid' ? { status: 'paid', payment_reference: payRef || null } : { status: 'cancelled' };
    const { error } = await supabase.from('payroll_runs').update(patch).eq('id', run.id);
    setConfirm(null);
    if (error) return toast.error(error.message);
    toast.success(`Payroll ${patch.status}`); load();
  };

  const exportCsv = () => downloadCsv(`${run.payroll_code}.csv`, [
    ['Code', 'Name', 'Department', 'KRA PIN', 'Basic', 'Allowances', 'Overtime', 'Bonus', 'Gross', 'NSSF', 'SHIF', 'Housing Levy', 'Taxable', 'PAYE', 'Other Deductions', 'Total Deductions', 'Net', 'Method', 'Account'],
    ...items.map((i) => [i.employee_code, i.employee_name, i.department_name, i.kra_pin, i.basic_salary, i.total_allowances, i.overtime, i.bonus, i.gross_salary,
      Number(i.nssf_tier1) + Number(i.nssf_tier2), i.shif_amount, i.housing_levy_amount, i.taxable_pay, i.net_paye, i.other_deductions, i.total_deductions, i.net_salary, i.payment_method, i.payment_account]),
  ]);
  const exportBank = () => downloadCsv(`${run.payroll_code}-payments.csv`, [
    ['Name', 'Method', 'Account / Phone', 'Amount', 'Reference'],
    ...items.map((i) => [i.employee_name, i.payment_method, i.payment_account, i.net_salary, `${run.payroll_code} ${i.employee_code}`]),
  ]);
  const sum = (k: keyof PayrollItem) => items.reduce((a, i) => a + Number(i[k] || 0), 0);

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3"><Link to="/admin/hr/payroll"><ArrowLeft className="h-4 w-4 mr-1" />Payroll</Link></Button>
      <Card className="mb-4"><CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-xl font-bold font-mono">{run.payroll_code}</h1>
            <Badge variant="outline" className={runStatusClass(run.status)}>{run.status}</Badge></div>
          <p className="text-sm text-muted-foreground">{MONTHS[run.period_month - 1]} {run.period_year} · {run.employee_count} employees
            {run.approved_at && ` · Approved by ${run.approved_by_name || 'admin'} on ${new Date(run.approved_at).toLocaleDateString('en-KE')}`}
            {run.payment_reference && ` · Ref ${run.payment_reference}`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {draft && <Button variant="outline" size="sm" onClick={regenerate}><RefreshCw className="h-4 w-4 mr-1" />Recalculate</Button>}
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Payroll CSV</Button>
          <Button variant="outline" size="sm" onClick={exportBank}><Download className="h-4 w-4 mr-1" />Payment list</Button>
          {draft && <Button variant="outline" size="sm" onClick={() => setConfirm('cancel')}><XCircle className="h-4 w-4 mr-1" />Cancel</Button>}
          {draft && <Button size="sm" onClick={() => setConfirm('approve')} disabled={!items.length}><CheckCircle2 className="h-4 w-4 mr-1" />Approve</Button>}
          {run.status === 'approved' && <Button size="sm" onClick={() => setConfirm('paid')}><Banknote className="h-4 w-4 mr-1" />Mark as paid</Button>}
        </div>
      </CardContent></Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {[['Gross pay', run.total_gross], ['PAYE', sum('net_paye')], ['NSSF + SHIF + Levy', sum('nssf_tier1') + sum('nssf_tier2') + sum('shif_amount') + sum('housing_levy_amount')], ['Net pay', run.total_net], ['Employer cost', run.total_employer_cost]].map(([l, v]) => (
          <Card key={l as string}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="font-bold">{kes(v as number)}</p></CardContent></Card>
        ))}
      </div>

      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Employee</th><th className="p-3 text-right">Gross</th><th className="p-3 text-right">PAYE</th><th className="p-3 text-right">NSSF</th><th className="p-3 text-right">SHIF</th><th className="p-3 text-right">Levy</th><th className="p-3 text-right">Other</th><th className="p-3 text-right">Net</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="p-3"><div className="font-medium">{i.employee_name}</div><div className="text-xs text-muted-foreground font-mono">{i.employee_code}{i.adjustment_note ? ` · ${i.adjustment_note}` : ''}</div></td>
                <td className="p-3 text-right">{kes(i.gross_salary)}</td>
                <td className="p-3 text-right">{kes(i.net_paye)}</td>
                <td className="p-3 text-right">{kes(Number(i.nssf_tier1) + Number(i.nssf_tier2))}</td>
                <td className="p-3 text-right">{kes(i.shif_amount)}</td>
                <td className="p-3 text-right">{kes(i.housing_levy_amount)}</td>
                <td className="p-3 text-right">{kes(i.other_deductions)}</td>
                <td className="p-3 text-right font-semibold">{kes(i.net_salary)}</td>
                <td className="p-3 text-right">
                  {draft && <Button variant="ghost" size="icon" onClick={() => openEdit(i)} aria-label="Adjust"><Pencil className="h-4 w-4" /></Button>}
                  <Button variant="ghost" size="icon" onClick={() => payslipPdf(run, i)} aria-label="Payslip"><FileText className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No employees in this run. Add salaries on employee Compensation tabs and recalculate.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust {edit?.employee_name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Overtime</Label><Input type="number" value={adj.overtime} onChange={(e) => setAdj({ ...adj, overtime: e.target.value })} /></div>
            <div><Label>Bonus</Label><Input type="number" value={adj.bonus} onChange={(e) => setAdj({ ...adj, bonus: e.target.value })} /></div>
            <div><Label>One-off deduction</Label><Input type="number" value={adj.deduction} onChange={(e) => setAdj({ ...adj, deduction: e.target.value })} /></div>
          </div>
          <div><Label>Reason</Label><Textarea value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} /></div>
          <DialogFooter><Button onClick={saveAdj} disabled={(!!adj.bonus || !!adj.overtime || !!adj.deduction) && !adj.note.trim()}>Save & recalculate</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === 'approve' ? 'Approve payroll?' : confirm === 'paid' ? 'Mark payroll as paid?' : 'Cancel payroll?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'approve' ? `Net pay of ${kes(run.total_net)} for ${run.employee_count} employees will be locked. No further edits are possible.`
                : confirm === 'paid' ? 'Every employee will be marked paid and a timeline entry recorded.' : 'This run will be voided so you can start again for this month.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm === 'paid' && <Input placeholder="Payment reference (M-Pesa batch / bank ref)" value={payRef} onChange={(e) => setPayRef(e.target.value)} />}
          <AlertDialogFooter><AlertDialogCancel>Back</AlertDialogCancel><AlertDialogAction onClick={transition}>Confirm</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
