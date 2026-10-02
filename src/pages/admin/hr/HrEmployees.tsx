import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Eye, Pencil, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import HrSubNav from '@/components/hr/HrSubNav';
import EmployeeFormDialog from '@/components/hr/EmployeeFormDialog';
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, fmtDate, label, statusClass, type Department, type Employee, type Position } from '@/lib/hr';

const ALL = 'all';

export default function HrEmployees() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [emps, setEmps] = useState<Employee[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState(ALL);
  const [pos, setPos] = useState(ALL);
  const [status, setStatus] = useState(params.get('status') || ALL);
  const [type, setType] = useState(ALL);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivate, setDeactivate] = useState<Employee | null>(null);

  const load = async () => {
    const [e, d, p] = await Promise.all([
      supabase.from('employees').select('*').order('created_at', { ascending: false }),
      supabase.from('hr_departments').select('*').order('name'),
      supabase.from('hr_positions').select('*').order('title'),
    ]);
    if (e.error) toast.error(e.error.message);
    setEmps(e.data || []); setDepts(d.data || []); setPositions(p.data || []);
  };
  useEffect(() => { load(); }, []);

  const dName = Object.fromEntries(depts.map((d) => [d.id, d.name]));
  const pName = Object.fromEntries(positions.map((p) => [p.id, p.title]));

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return emps.filter((e) =>
      (!s || [e.full_name, e.employee_code, e.phone, e.email].some((v) => v?.toLowerCase().includes(s))) &&
      (dept === ALL || e.department_id === dept) && (pos === ALL || e.position_id === pos) &&
      (status === ALL || e.employment_status === status) && (type === ALL || e.employment_type === type));
  }, [emps, q, dept, pos, status, type]);

  const doDeactivate = async () => {
    if (!deactivate) return;
    const { error } = await supabase.from('employees').update({ employment_status: 'inactive' }).eq('id', deactivate.id);
    if (error) toast.error(error.message); else toast.success('Employee deactivated');
    setDeactivate(null); load();
  };

  const filter = (val: string, set: (v: string) => void, ph: string, opts: { v: string; l: string }[]) => (
    <Select value={val} onValueChange={set}>
      <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder={ph} /></SelectTrigger>
      <SelectContent><SelectItem value={ALL}>All {ph}</SelectItem>{opts.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
    </Select>
  );

  const actions = (e: Employee) => (
    <div className="flex gap-1 justify-end">
      <Button size="icon" variant="ghost" asChild title="View 360"><Link to={`/admin/hr/employees/${e.id}`}><Eye className="h-4 w-4" /></Link></Button>
      <Button size="icon" variant="ghost" title="Edit" onClick={() => { setEditing(e); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
      {e.employment_status !== 'inactive' && <Button size="icon" variant="ghost" title="Deactivate" onClick={() => setDeactivate(e)}><UserX className="h-4 w-4 text-destructive" /></Button>}
    </div>
  );

  return (
    <div>
      <HrSubNav title="Employees" subtitle={`${rows.length} of ${emps.length} employees`}
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-1" />Add Employee</Button>} />

      <Card className="p-3 mb-4 flex flex-col sm:flex-row flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search name, code, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {filter(dept, setDept, 'Departments', depts.map((d) => ({ v: d.id, l: d.name })))}
        {filter(pos, setPos, 'Positions', positions.map((p) => ({ v: p.id, l: p.title })))}
        {filter(status, setStatus, 'Statuses', EMPLOYMENT_STATUSES.map((v) => ({ v, l: label(v) })))}
        {filter(type, setType, 'Types', EMPLOYMENT_TYPES.map((v) => ({ v, l: label(v) })))}
      </Card>

      <Card className="hidden md:block">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Employee</TableHead><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Position</TableHead>
            <TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Hire Date</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((e) => (
              <TableRow key={e.id} className="cursor-pointer" onClick={() => nav(`/admin/hr/employees/${e.id}`)}>
                <TableCell><div className="font-medium">{e.full_name}</div><div className="text-xs text-muted-foreground">{e.phone || e.email || ''}</div></TableCell>
                <TableCell className="font-mono text-xs">{e.employee_code}</TableCell>
                <TableCell>{dName[e.department_id || ''] || '—'}</TableCell>
                <TableCell>{pName[e.position_id || ''] || '—'}</TableCell>
                <TableCell>{label(e.employment_type)}</TableCell>
                <TableCell><Badge variant="outline" className={statusClass(e.employment_status)}>{label(e.employment_status)}</Badge></TableCell>
                <TableCell>{fmtDate(e.hire_date)}</TableCell>
                <TableCell onClick={(ev) => ev.stopPropagation()}>{actions(e)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No employees found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <div className="md:hidden space-y-2">
        {rows.map((e) => (
          <Card key={e.id} className="p-3">
            <div className="flex justify-between gap-2">
              <Link to={`/admin/hr/employees/${e.id}`} className="min-w-0">
                <div className="font-medium truncate">{e.full_name}</div>
                <div className="text-xs text-muted-foreground font-mono">{e.employee_code}</div>
                <div className="text-xs text-muted-foreground">{pName[e.position_id || ''] || '—'} · {dName[e.department_id || ''] || '—'}</div>
              </Link>
              <Badge variant="outline" className={statusClass(e.employment_status)}>{label(e.employment_status)}</Badge>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground"><span>Hired {fmtDate(e.hire_date)}</span>{actions(e)}</div>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No employees found.</p>}
      </div>

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editing} onSaved={load} />
      <AlertDialog open={!!deactivate} onOpenChange={(o) => !o && setDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Deactivate {deactivate?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>The record is kept for history and can be reactivated by editing the employment status.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={doDeactivate}>Deactivate</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
