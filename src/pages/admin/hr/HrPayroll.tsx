import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Wallet, Users, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import HrSubNav from '@/components/hr/HrSubNav';
import { computePay, kes, MONTHS, runStatusClass, type PayrollRun } from '@/lib/payroll';

export async function generatePayrollItems(runId: string) {
  const [emps, comps, parts, depts, poss] = await Promise.all([
    supabase.from('employees').select('*').eq('employment_status', 'active'),
    supabase.from('employee_compensation').select('*'),
    supabase.from('employee_pay_components').select('*').eq('is_active', true),
    supabase.from('hr_departments').select('id,name'),
    supabase.from('hr_positions').select('id,title'),
  ]);
  const rows = (emps.data || []).flatMap((e) => {
    const c = (comps.data || []).find((x) => x.employee_id === e.id);
    if (!c || Number(c.basic_salary) <= 0) return [];
    const mine = (parts.data || []).filter((p) => p.employee_id === e.id);
    const pay = computePay({
      basic: Number(c.basic_salary),
      allowances: mine.filter((p) => p.kind === 'allowance').map((p) => ({ name: p.name, amount: Number(p.amount), taxable: p.is_taxable })),
      deductions: mine.filter((p) => p.kind === 'deduction').map((p) => ({ name: p.name, amount: Number(p.amount) })),
      exempt: { nssf: c.nssf_exempt, shif: c.shif_exempt, housing: c.housing_levy_exempt, paye: c.paye_exempt },
    });
    return [{
      ...pay, earnings_breakdown: pay.earnings_breakdown as any, deductions_breakdown: pay.deductions_breakdown as any,
      payroll_run_id: runId, employee_id: e.id, employee_code: e.employee_code, employee_name: e.full_name,
      department_name: depts.data?.find((d) => d.id === e.department_id)?.name || null,
      position_title: poss.data?.find((p) => p.id === e.position_id)?.title || null,
      payment_method: c.payment_method, kra_pin: c.kra_pin,
      payment_account: c.payment_method === 'bank' ? [c.bank_name, c.bank_account_number].filter(Boolean).join(' ') : c.payment_method === 'mpesa' ? c.mpesa_number : null,
    }];
  });
  await supabase.from('payroll_items').delete().eq('payroll_run_id', runId);
  if (rows.length) {
    const { error } = await supabase.from('payroll_items').insert(rows);
    if (error) throw error;
  }
  await recalcRunTotals(runId);
  return rows.length;
}

export async function recalcRunTotals(runId: string) {
  const { data } = await supabase.from('payroll_items').select('gross_salary,total_deductions,net_salary,employer_nssf,employer_housing_levy').eq('payroll_run_id', runId);
  const s = (k: string) => (data || []).reduce((a, r: any) => a + Number(r[k] || 0), 0);
  await supabase.from('payroll_runs').update({
    employee_count: data?.length || 0, total_gross: s('gross_salary'), total_deductions: s('total_deductions'), total_net: s('net_salary'),
    total_employer_cost: s('gross_salary') + s('employer_nssf') + s('employer_housing_levy'),
  }).eq('id', runId);
}

export default function HrPayroll() {
  const nav = useNavigate();
  const { profile } = useAuth();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [configured, setConfigured] = useState(0);
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [r, c] = await Promise.all([
      supabase.from('payroll_runs').select('*').order('period_year', { ascending: false }).order('period_month', { ascending: false }),
      supabase.from('employee_compensation').select('id', { count: 'exact', head: true }).gt('basic_salary', 0),
    ]);
    setRuns(r.data || []); setConfigured(c.count || 0);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      const m = Number(month), y = Number(year);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const end = new Date(y, m, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase.from('payroll_runs').insert({
        payroll_code: 'auto', period_month: m, period_year: y, start_date: start, end_date: end, pay_date: end,
        created_by_name: (profile as any)?.full_name || null,
      }).select().single();
      if (error) throw error;
      const n = await generatePayrollItems(data.id);
      toast.success(`Payroll ${data.payroll_code} created for ${n} employees`);
      nav(`/admin/hr/payroll/${data.id}`);
    } catch (e: any) {
      toast.error(e.message?.includes('uq_payroll_period') ? 'A payroll already exists for that month' : e.message);
    } finally { setBusy(false); }
  };

  const last = runs.find((r) => r.status === 'paid' || r.status === 'approved');
  const pending = runs.filter((r) => r.status === 'draft').length;
  const Stat = ({ icon: I, label, value }: any) => (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><I className="h-5 w-5" /></div>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold">{value}</p></div>
    </CardContent></Card>
  );

  return (
    <div>
      <HrSubNav title="Payroll" subtitle="Monthly payroll with Kenyan PAYE, NSSF, SHIF and Housing Levy"
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />New Payroll Run</Button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat icon={Wallet} label="Last approved net pay" value={last ? kes(last.total_net) : '—'} />
        <Stat icon={Users} label="Employees with salary set" value={configured} />
        <Stat icon={Clock} label="Draft runs" value={pending} />
        <Stat icon={CheckCircle2} label="Paid runs" value={runs.filter((r) => r.status === 'paid').length} />
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Payroll</th><th className="p-3">Period</th><th className="p-3">Staff</th><th className="p-3 text-right">Gross</th><th className="p-3 text-right">Net</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody className="divide-y">
            {runs.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="p-3 font-mono"><Link className="text-primary hover:underline" to={`/admin/hr/payroll/${r.id}`}>{r.payroll_code}</Link></td>
                <td className="p-3">{MONTHS[r.period_month - 1]} {r.period_year}</td>
                <td className="p-3">{r.employee_count}</td>
                <td className="p-3 text-right">{kes(r.total_gross)}</td>
                <td className="p-3 text-right font-semibold">{kes(r.total_net)}</td>
                <td className="p-3"><Badge variant="outline" className={runStatusClass(r.status)}>{r.status}</Badge></td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No payroll runs yet. Set salaries on each employee's Compensation tab, then start a run.</td></tr>}
          </tbody>
        </table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New payroll run</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Month</Label>
              <Select value={month} onValueChange={setMonth}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Year</Label><Input type="number" value={year} onChange={(e) => setYear(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">All active employees with a basic salary will be included ({configured}).</p>
          <DialogFooter><Button onClick={create} disabled={busy}>{busy ? 'Generating…' : 'Generate payroll'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
