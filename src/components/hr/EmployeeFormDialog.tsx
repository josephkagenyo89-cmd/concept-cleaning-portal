import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, GENDERS, MARITAL, label, loadHrLookups,
  type Employee, type Department, type Position,
} from '@/lib/hr';

type Form = Record<string, string>;
const FIELDS = ['first_name','middle_name','last_name','date_of_birth','gender','marital_status','national_id','photo_url',
  'phone','alternate_phone','email','physical_address','town','county',
  'emergency_contact_name','emergency_contact_phone','emergency_contact_relationship',
  'department_id','position_id','manager_id','employment_type','employment_status','hire_date','probation_end_date','work_location','notes'];
const NONE = '__none__';

export default function EmployeeFormDialog({ open, onOpenChange, employee, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; employee?: Employee | null; onSaved?: (id: string) => void;
}) {
  const [form, setForm] = useState<Form>({});
  const [saving, setSaving] = useState(false);
  const [lk, setLk] = useState<{ departments: Department[]; positions: Position[]; managers: { id: string; full_name: string | null; employee_code: string }[] }>({ departments: [], positions: [], managers: [] });

  useEffect(() => {
    if (!open) return;
    loadHrLookups().then(setLk);
    const f: Form = {};
    FIELDS.forEach((k) => { f[k] = ((employee as any)?.[k] ?? '') as string; });
    if (!employee) f.employment_status = 'active';
    setForm(f);
  }, [open, employee]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v === NONE ? '' : v }));

  const save = async () => {
    if (!form.first_name?.trim() || !form.last_name?.trim()) { toast.error('First and last name are required'); return; }
    setSaving(true);
    const payload: any = {};
    FIELDS.forEach((k) => { const v = form[k]?.trim?.() ?? form[k]; payload[k] = v === '' ? null : v; });
    payload.employment_status = payload.employment_status || 'active';
    const res = employee
      ? await supabase.from('employees').update(payload).eq('id', employee.id).select('id').single()
      : await supabase.from('employees').insert(payload).select('id').single();
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(employee ? 'Employee updated' : 'Employee created');
    onOpenChange(false);
    onSaved?.(res.data.id);
  };

  const txt = (k: string, l: string, type = 'text') => (
    <div className="space-y-1"><Label className="text-xs">{l}</Label>
      <Input type={type} value={form[k] || ''} onChange={(e) => set(k, e.target.value)} /></div>
  );
  const sel = (k: string, l: string, opts: { v: string; l: string }[]) => (
    <div className="space-y-1"><Label className="text-xs">{l}</Label>
      <Select value={form[k] || NONE} onValueChange={(v) => set(k, v)}>
        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— None —</SelectItem>
          {opts.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select></div>
  );
  const enumOpts = (arr: readonly string[]) => arr.map((v) => ({ v, l: label(v) }));
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary border-b pb-1">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
    </section>
  );

  const positions = lk.positions.filter((p) => !form.department_id || !p.department_id || p.department_id === form.department_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{employee ? `Edit ${employee.full_name}` : 'Add Employee'}</DialogTitle></DialogHeader>
        <div className="space-y-6">
          {Section({ title: 'Personal Information', children: <>
            {txt('first_name', 'First Name *')}{txt('middle_name', 'Middle Name')}{txt('last_name', 'Last Name *')}
            {txt('date_of_birth', 'Date of Birth', 'date')}{sel('gender', 'Gender', enumOpts(GENDERS))}
            {sel('marital_status', 'Marital Status', enumOpts(MARITAL))}{txt('national_id', 'National ID')}{txt('photo_url', 'Photo URL')}
          </> })}
          {Section({ title: 'Contact', children: <>
            {txt('phone', 'Phone')}{txt('alternate_phone', 'Alternate Phone')}{txt('email', 'Email', 'email')}
            {txt('physical_address', 'Physical Address')}{txt('town', 'Town')}{txt('county', 'County')}
          </> })}
          {Section({ title: 'Emergency Contact', children: <>
            {txt('emergency_contact_name', 'Name')}{txt('emergency_contact_phone', 'Phone')}{txt('emergency_contact_relationship', 'Relationship')}
          </> })}
          {Section({ title: 'Employment', children: <>
            <div className="space-y-1"><Label className="text-xs">Employee Code</Label>
              <Input disabled value={employee?.employee_code || 'Auto-generated on save'} /></div>
            {sel('department_id', 'Department', lk.departments.filter((d) => d.is_active || d.id === form.department_id).map((d) => ({ v: d.id, l: d.name })))}
            {sel('position_id', 'Position', positions.filter((p) => p.is_active || p.id === form.position_id).map((p) => ({ v: p.id, l: p.title })))}
            {sel('manager_id', 'Manager', lk.managers.filter((m) => m.id !== employee?.id).map((m) => ({ v: m.id, l: `${m.full_name} (${m.employee_code})` })))}
            {sel('employment_type', 'Employment Type', enumOpts(EMPLOYMENT_TYPES))}
            {sel('employment_status', 'Employment Status', enumOpts(EMPLOYMENT_STATUSES))}
            {txt('hire_date', 'Hire Date', 'date')}{txt('probation_end_date', 'Probation End Date', 'date')}{txt('work_location', 'Work Location')}
          </> })}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary border-b pb-1">Notes</h3>
            <Textarea rows={3} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} />
          </section>
          <p className="text-xs text-muted-foreground">No ERP login is created for this employee.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Employee'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
