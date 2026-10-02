import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import HrSubNav from '@/components/hr/HrSubNav';

type Kind = 'department' | 'position';
const NONE = '__none__';

export default function OrgUnitPage({ kind }: { kind: Kind }) {
  const isDept = kind === 'department';
  const table = isDept ? 'hr_departments' : 'hr_positions';
  const nameKey = isDept ? 'name' : 'title';
  const linkKey = isDept ? 'manager_employee_id' : 'department_id';
  const countKey = isDept ? 'department_id' : 'position_id';

  const [rows, setRows] = useState<any[]>([]);
  const [emps, setEmps] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [r, e, d] = await Promise.all([
      (supabase.from(table) as any).select('*').order(nameKey),
      supabase.from('employees').select('id, full_name, employee_code, department_id, position_id'),
      supabase.from('hr_departments').select('id, name'),
    ]);
    setRows(r.data || []); setEmps(e.data || []); setDepts(d.data || []);
  };
  useEffect(() => { load(); }, [kind]);

  const openForm = (row?: any) => { setForm(row ? { ...row } : { is_active: true }); setOpen(true); };

  const save = async () => {
    if (!form[nameKey]?.trim()) { toast.error(`${isDept ? 'Name' : 'Title'} is required`); return; }
    setSaving(true);
    const payload = {
      [nameKey]: form[nameKey].trim(), code: form.code?.trim() || null, description: form.description?.trim() || null,
      [linkKey]: form[linkKey] || null, is_active: !!form.is_active,
    };
    const q = supabase.from(table) as any;
    const { error } = form.id ? await q.update(payload).eq('id', form.id) : await q.insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message.includes('duplicate') ? 'That code is already in use' : error.message); return; }
    toast.success('Saved'); setOpen(false); load();
  };

  const linkName = (r: any) => isDept
    ? emps.find((e) => e.id === r.manager_employee_id)?.full_name
    : depts.find((d) => d.id === r.department_id)?.name;
  const linkOpts = isDept ? emps.map((e) => ({ v: e.id, l: `${e.full_name} (${e.employee_code})` })) : depts.map((d) => ({ v: d.id, l: d.name }));

  return (
    <div>
      <HrSubNav title={isDept ? 'Departments' : 'Positions'} subtitle={`${rows.length} ${isDept ? 'departments' : 'positions'}`}
        actions={<Button onClick={() => openForm()}><Plus className="h-4 w-4 mr-1" />Add {isDept ? 'Department' : 'Position'}</Button>} />
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{isDept ? 'Department' : 'Position'}</TableHead><TableHead>Code</TableHead>
            <TableHead>{isDept ? 'Manager' : 'Department'}</TableHead><TableHead className="text-center">Employees</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{r[nameKey]}</div>{r.description && <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>}</TableCell>
                <TableCell className="font-mono text-xs">{r.code || '—'}</TableCell>
                <TableCell>{linkName(r) || '—'}</TableCell>
                <TableCell className="text-center font-medium">{emps.filter((e) => e[countKey] === r.id).length}</TableCell>
                <TableCell><Badge variant="outline" className={r.is_active ? 'bg-success/15 text-success border-success/30' : 'text-muted-foreground'}>{r.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => openForm(r)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nothing here yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? 'Edit' : 'Add'} {isDept ? 'Department' : 'Position'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{isDept ? 'Department name' : 'Position title'} *</Label><Input value={form[nameKey] || ''} onChange={(e) => setForm({ ...form, [nameKey]: e.target.value })} /></div>
            <div className="space-y-1"><Label>Code</Label><Input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div className="space-y-1"><Label>{isDept ? 'Department manager' : 'Department'}</Label>
              <Select value={form[linkKey] || NONE} onValueChange={(v) => setForm({ ...form, [linkKey]: v === NONE ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>— None —</SelectItem>{linkOpts.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="space-y-1"><Label>Description</Label><Textarea rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Active</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
