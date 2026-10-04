import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { computePay, kes, PAYMENT_METHODS, type PayComponent } from '@/lib/payroll';
import { label } from '@/lib/hr';

const EMPTY = { basic_salary: '', payment_method: 'mpesa', bank_name: '', bank_branch: '', bank_account_number: '', mpesa_number: '', kra_pin: '', nssf_number: '', shif_number: '',
  nssf_exempt: false, shif_exempt: false, housing_levy_exempt: false, paye_exempt: false };

export default function CompensationTab({ employeeId }: { employeeId: string }) {
  const [f, setF] = useState<any>(EMPTY);
  const [parts, setParts] = useState<PayComponent[]>([]);
  const [np, setNp] = useState({ kind: 'allowance', name: '', amount: '', is_taxable: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [c, p] = await Promise.all([
      supabase.from('employee_compensation').select('*').eq('employee_id', employeeId).maybeSingle(),
      supabase.from('employee_pay_components').select('*').eq('employee_id', employeeId).order('created_at'),
    ]);
    if (c.data) setF({ ...EMPTY, ...Object.fromEntries(Object.entries(c.data).map(([k, v]) => [k, v ?? ''])), basic_salary: String(c.data.basic_salary) });
    setParts(p.data || []);
  };
  useEffect(() => { load(); }, [employeeId]);

  const save = async () => {
    setSaving(true);
    const n = (v: string) => (v?.toString().trim() ? v.toString().trim() : null);
    const { error } = await supabase.from('employee_compensation').upsert({
      employee_id: employeeId, basic_salary: Number(f.basic_salary || 0), payment_method: f.payment_method,
      bank_name: n(f.bank_name), bank_branch: n(f.bank_branch), bank_account_number: n(f.bank_account_number), mpesa_number: n(f.mpesa_number),
      kra_pin: n(f.kra_pin)?.toUpperCase() || null, nssf_number: n(f.nssf_number), shif_number: n(f.shif_number),
      nssf_exempt: f.nssf_exempt, shif_exempt: f.shif_exempt, housing_levy_exempt: f.housing_levy_exempt, paye_exempt: f.paye_exempt,
    }, { onConflict: 'employee_id' });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Compensation saved'); load();
  };

  const addPart = async () => {
    if (!np.name.trim() || !Number(np.amount)) return toast.error('Name and amount required');
    const { error } = await supabase.from('employee_pay_components').insert({ employee_id: employeeId, kind: np.kind, name: np.name.trim(), amount: Number(np.amount), is_taxable: np.is_taxable });
    if (error) return toast.error(error.message);
    setNp({ ...np, name: '', amount: '' }); load();
  };
  const togglePart = async (p: PayComponent) => { await supabase.from('employee_pay_components').update({ is_active: !p.is_active }).eq('id', p.id); load(); };
  const removePart = async (p: PayComponent) => { await supabase.from('employee_pay_components').delete().eq('id', p.id); load(); };

  const active = parts.filter((p) => p.is_active);
  const preview = computePay({
    basic: Number(f.basic_salary || 0),
    allowances: active.filter((p) => p.kind === 'allowance').map((p) => ({ name: p.name, amount: Number(p.amount), taxable: p.is_taxable })),
    deductions: active.filter((p) => p.kind === 'deduction').map((p) => ({ name: p.name, amount: Number(p.amount) })),
    exempt: { nssf: f.nssf_exempt, shif: f.shif_exempt, housing: f.housing_levy_exempt, paye: f.paye_exempt },
  });
  const T = (k: string, l: string, ph?: string) => <div><Label>{l}</Label><Input value={f[k]} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;

  return (
    <div className="grid lg:grid-cols-3 gap-4 mt-4">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-primary">Salary & Payment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label>Basic salary (KES / month)</Label><Input type="number" value={f.basic_salary} onChange={(e) => setF({ ...f, basic_salary: e.target.value })} /></div>
            <div><Label>Payment method</Label>
              <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m === 'mpesa' ? 'M-Pesa' : label(m)}</SelectItem>)}</SelectContent></Select></div>
            {f.payment_method === 'mpesa' && T('mpesa_number', 'M-Pesa number', '07XXXXXXXX')}
          </div>
          {f.payment_method === 'bank' && <div className="grid sm:grid-cols-3 gap-3">{T('bank_name', 'Bank')}{T('bank_branch', 'Branch')}{T('bank_account_number', 'Account number')}</div>}
          <div className="grid sm:grid-cols-3 gap-3">{T('kra_pin', 'KRA PIN', 'A000000000X')}{T('nssf_number', 'NSSF number')}{T('shif_number', 'SHIF / SHA number')}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['nssf_exempt', 'NSSF exempt'], ['shif_exempt', 'SHIF exempt'], ['housing_levy_exempt', 'Levy exempt'], ['paye_exempt', 'PAYE exempt']].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm"><Switch checked={f[k]} onCheckedChange={(v) => setF({ ...f, [k]: v })} />{l}</label>
            ))}
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save compensation'}</Button>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-2">Recurring allowances & deductions</p>
            <div className="divide-y border rounded-md">
              {parts.map((p) => (
                <div key={p.id} className="flex items-center gap-2 p-2 text-sm">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${p.kind === 'allowance' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>{p.kind}</span>
                  <span className={`flex-1 ${p.is_active ? '' : 'line-through text-muted-foreground'}`}>{p.name}{p.kind === 'allowance' && !p.is_taxable ? ' (non-taxable)' : ''}</span>
                  <span className="font-medium">{kes(p.amount)}</span>
                  <Switch checked={p.is_active} onCheckedChange={() => togglePart(p)} />
                  <Button variant="ghost" size="icon" onClick={() => removePart(p)} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {!parts.length && <p className="p-3 text-sm text-muted-foreground">None yet — e.g. House allowance, Transport, Sacco, Loan.</p>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2 items-end">
              <Select value={np.kind} onValueChange={(v) => setNp({ ...np, kind: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="allowance">Allowance</SelectItem><SelectItem value="deduction">Deduction</SelectItem></SelectContent></Select>
              <Input placeholder="Name" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
              <Input type="number" placeholder="Amount" value={np.amount} onChange={(e) => setNp({ ...np, amount: e.target.value })} />
              {np.kind === 'allowance' ? <label className="flex items-center gap-2 text-xs"><Switch checked={np.is_taxable} onCheckedChange={(v) => setNp({ ...np, is_taxable: v })} />Taxable</label> : <span />}
              <Button variant="outline" onClick={addPart}><Plus className="h-4 w-4 mr-1" />Add</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-primary">Monthly Pay Preview</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          {[['Gross pay', preview.gross_salary], ['NSSF', preview.nssf_tier1 + preview.nssf_tier2], ['SHIF', preview.shif_amount], ['Housing Levy', preview.housing_levy_amount],
            ['Taxable pay', preview.taxable_pay], ['PAYE (after relief)', preview.net_paye], ['Other deductions', preview.other_deductions]].map(([l, v]) => (
            <div key={l as string} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span>{kes(v as number)}</span></div>
          ))}
          <div className="flex justify-between border-t pt-2 mt-2 font-bold text-base"><span>Net pay</span><span className="text-success">{kes(preview.net_salary)}</span></div>
          <p className="text-xs text-muted-foreground pt-2">Unsaved changes are previewed live. Payroll runs snapshot these figures.</p>
        </CardContent>
      </Card>
    </div>
  );
}
