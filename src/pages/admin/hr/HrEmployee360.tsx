import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import EmployeeFormDialog from '@/components/hr/EmployeeFormDialog';
import { fmtDate, label, statusClass, type Department, type Employee, type EmploymentRecord, type Position, type TimelineEvent } from '@/lib/hr';

const FUTURE = ['Attendance', 'Leave', 'Payroll', 'Performance', 'Training', 'Documents', 'Disciplinary', 'Assets'];

export default function HrEmployee360() {
  const { id } = useParams();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [depts, setDepts] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [manager, setManager] = useState<Employee | null>(null);
  const [reports, setReports] = useState(0);
  const [history, setHistory] = useState<EmploymentRecord[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [edit, setEdit] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from('employees').select('*').eq('id', id).maybeSingle();
    if (!data) { setMissing(true); return; }
    setEmp(data);
    const [d, p, h, t, r, m] = await Promise.all([
      supabase.from('hr_departments').select('*'),
      supabase.from('hr_positions').select('*'),
      supabase.from('employee_employment').select('*').eq('employee_id', id).order('created_at', { ascending: false }),
      supabase.from('employee_timeline').select('*').eq('employee_id', id).order('created_at', { ascending: false }),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('manager_id', id),
      data.manager_id ? supabase.from('employees').select('*').eq('id', data.manager_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setDepts(d.data || []); setPositions(p.data || []); setHistory(h.data || []); setTimeline(t.data || []);
    setReports(r.count || 0); setManager((m as any).data || null);
  };
  useEffect(() => { load(); }, [id]);

  if (missing) return <div className="p-8 text-center"><p className="mb-3">Employee not found.</p><Button asChild variant="outline"><Link to="/admin/hr/employees">Back to employees</Link></Button></div>;
  if (!emp) return <div className="flex justify-center p-12"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div>;

  const dName = (x?: string | null) => depts.find((d) => d.id === x)?.name || '—';
  const pName = (x?: string | null) => positions.find((p) => p.id === x)?.title || '—';
  const tenureDays = emp.hire_date ? Math.max(0, Math.floor((Date.now() - new Date(emp.hire_date).getTime()) / 86400000)) : null;

  const Info = ({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-primary">{title}</CardTitle></CardHeader>
      <CardContent><dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => <><dt key={k + 'k'} className="text-muted-foreground">{k}</dt><dd key={k + 'v'} className="font-medium break-words">{v || '—'}</dd></>)}
      </dl></CardContent>
    </Card>
  );

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3"><Link to="/admin/hr/employees"><ArrowLeft className="h-4 w-4 mr-1" />Employees</Link></Button>
      <Card className="mb-4 overflow-hidden">
        <div className="h-2 bg-primary" />
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
          {emp.photo_url
            ? <img src={emp.photo_url} alt={emp.full_name || ''} className="h-20 w-20 rounded-full object-cover ring-2 ring-primary/30" />
            : <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">{emp.first_name[0]}{emp.last_name[0]}</div>}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-bold">{emp.full_name}</h1>
              <Badge variant="outline" className={statusClass(emp.employment_status)}>{label(emp.employment_status)}</Badge></div>
            <p className="font-mono text-xs text-muted-foreground">{emp.employee_code}</p>
            <p className="text-sm mt-1">{pName(emp.position_id)} · {dName(emp.department_id)}</p>
            <p className="text-xs text-muted-foreground">Hired {fmtDate(emp.hire_date)}</p>
          </div>
          <Button onClick={() => setEdit(true)}><Pencil className="h-4 w-4 mr-1" />Edit</Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full overflow-x-auto justify-start h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          {FUTURE.map((f) => <TabsTrigger key={f} value={f} disabled title="Coming in a later phase">{f}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="overview" className="grid md:grid-cols-2 gap-4 mt-4">
          <Info title="Personal Information" rows={[['Date of birth', fmtDate(emp.date_of_birth)], ['Gender', label(emp.gender)], ['Marital status', label(emp.marital_status)], ['National ID', emp.national_id]]} />
          <Info title="Contact" rows={[['Phone', emp.phone], ['Alt. phone', emp.alternate_phone], ['Email', emp.email], ['Address', emp.physical_address], ['Town', emp.town], ['County', emp.county]]} />
          <Info title="Emergency Contact" rows={[['Name', emp.emergency_contact_name], ['Phone', emp.emergency_contact_phone], ['Relationship', emp.emergency_contact_relationship]]} />
          <Info title="Current Employment" rows={[['Department', dName(emp.department_id)], ['Position', pName(emp.position_id)], ['Type', label(emp.employment_type)], ['Work location', emp.work_location], ['Probation ends', fmtDate(emp.probation_end_date)],
            ['Reporting manager', manager ? <Link className="text-primary underline" to={`/admin/hr/employees/${manager.id}`}>{manager.full_name}</Link> : '—']]} />
          <Info title="Statistics" rows={[['Tenure', tenureDays !== null ? `${Math.floor(tenureDays / 365)}y ${Math.floor((tenureDays % 365) / 30)}m` : '—'], ['Direct reports', reports], ['Employment records', history.length], ['Timeline events', timeline.length], ['ERP login', emp.user_id ? 'Linked' : 'None']]} />
          {emp.notes && <Info title="Notes" rows={[['', emp.notes]]} />}
        </TabsContent>

        <TabsContent value="employment" className="mt-4">
          <Card><CardContent className="p-0 divide-y">
            {history.map((h, i) => (
              <div key={h.id} className="p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{pName(h.position_id)} · {dName(h.department_id)}</span>
                  {i === 0 && !h.end_date ? <Badge>Current</Badge> : <span className="text-xs text-muted-foreground">Ended {fmtDate(h.end_date)}</span>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {label(h.employment_type)} · {label(h.employment_status)} · From {fmtDate(h.start_date)}{h.work_location ? ` · ${h.work_location}` : ''}
                </div>
                {h.notes && <div className="text-xs mt-1">{h.notes}</div>}
              </div>
            ))}
            {history.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No employment history.</p>}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card><CardContent className="p-4">
            <ol className="relative border-l border-border ml-2 space-y-4">
              {timeline.map((t) => (
                <li key={t.id} className="ml-4">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                  <div className="text-sm font-medium">{t.event_title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString('en-KE')}</div>
                  {t.description && <div className="text-sm mt-0.5">{t.description}</div>}
                </li>
              ))}
            </ol>
            {timeline.length === 0 && <p className="text-center text-sm text-muted-foreground">No events.</p>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <EmployeeFormDialog open={edit} onOpenChange={setEdit} employee={emp} onSaved={load} />
    </div>
  );
}
