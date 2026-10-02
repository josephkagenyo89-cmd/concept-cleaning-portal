import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserCheck, Plane, UserPlus, Hourglass } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import HrSubNav from '@/components/hr/HrSubNav';
import { fmtDate, label, statusClass, type Department, type Employee, type TimelineEvent } from '@/lib/hr';

const DAY = 86400000;

export default function HrDashboard() {
  const [emps, setEmps] = useState<Employee[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from('employees').select('*'),
      supabase.from('hr_departments').select('*').order('name'),
      supabase.from('employee_timeline').select('*').order('created_at', { ascending: false }).limit(10),
    ]).then(([e, d, t]) => { setEmps(e.data || []); setDepts(d.data || []); setEvents(t.data || []); });
  }, []);

  const now = Date.now();
  const stats = useMemo(() => {
    const active = emps.filter((e) => e.employment_status === 'active');
    const newHires = emps.filter((e) => e.hire_date && now - new Date(e.hire_date).getTime() <= 30 * DAY && new Date(e.hire_date).getTime() <= now);
    const probation = emps.filter((e) => e.probation_end_date && ['active', 'on_leave'].includes(e.employment_status) && (() => {
      const t = new Date(e.probation_end_date!).getTime(); return t >= now - DAY && t - now <= 30 * DAY; })());
    return { active, newHires, probation, onLeave: emps.filter((e) => e.employment_status === 'on_leave') };
  }, [emps, now]);

  const attention = emps.filter((e) =>
    ['active', 'on_leave'].includes(e.employment_status) && (!e.department_id || !e.position_id || !e.phone || !e.emergency_contact_phone));
  const nameOf = Object.fromEntries(emps.map((e) => [e.id, e.full_name]));

  const kpis = [
    { label: 'Total Employees', value: emps.length, icon: Users, to: '/admin/hr/employees' },
    { label: 'Active Employees', value: stats.active.length, icon: UserCheck, to: '/admin/hr/employees?status=active' },
    { label: 'On Leave', value: stats.onLeave.length, icon: Plane, to: '/admin/hr/employees?status=on_leave' },
    { label: 'New Hires (30d)', value: stats.newHires.length, icon: UserPlus, to: '/admin/hr/employees' },
    { label: 'Probation Ending (30d)', value: stats.probation.length, icon: Hourglass, to: '/admin/hr/employees' },
  ];

  return (
    <div>
      <HrSubNav title="HR Dashboard" subtitle="Workforce overview for Concept Cleaning Services" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to}>
            <Card className="hover:border-primary transition-colors h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs">{k.label}</span><k.icon className="h-4 w-4 text-primary" /></div>
                <div className="text-2xl font-bold mt-1">{k.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Department Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {depts.length === 0 && <p className="text-sm text-muted-foreground">No departments yet. <Link className="text-primary underline" to="/admin/hr/departments">Add one</Link></p>}
            {depts.map((d) => {
              const n = emps.filter((e) => e.department_id === d.id).length;
              const pct = emps.length ? (n / emps.length) * 100 : 0;
              return (
                <div key={d.id}>
                  <div className="flex justify-between text-sm"><span>{d.name}</span><span className="font-medium">{n}</span></div>
                  <div className="h-1.5 rounded bg-muted mt-1"><div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent Hires</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {[...emps].filter((e) => e.hire_date).sort((a, b) => b.hire_date!.localeCompare(a.hire_date!)).slice(0, 6).map((e) => (
              <Link key={e.id} to={`/admin/hr/employees/${e.id}`} className="flex justify-between py-2 text-sm hover:text-primary">
                <span>{e.full_name} <span className="text-muted-foreground text-xs">{e.employee_code}</span></span>
                <span className="text-muted-foreground">{fmtDate(e.hire_date)}</span>
              </Link>
            ))}
            {emps.every((e) => !e.hire_date) && <p className="text-sm text-muted-foreground">No hires recorded.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Employees Requiring Attention</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {[...stats.probation.map((e) => ({ e, why: `Probation ends ${fmtDate(e.probation_end_date)}` })),
              ...attention.filter((e) => !stats.probation.includes(e)).map((e) => ({ e, why:
                [!e.department_id && 'no department', !e.position_id && 'no position', !e.phone && 'no phone', !e.emergency_contact_phone && 'no emergency contact'].filter(Boolean).join(', ') }))]
              .slice(0, 8).map(({ e, why }) => (
                <Link key={e.id} to={`/admin/hr/employees/${e.id}`} className="flex justify-between gap-2 py-2 text-sm hover:text-primary">
                  <span>{e.full_name}</span><span className="text-xs text-warning text-right">{why}</span>
                </Link>
              ))}
            {stats.probation.length + attention.length === 0 && <p className="text-sm text-muted-foreground">All records look complete.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent HR Activity</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {events.map((ev) => (
              <Link key={ev.id} to={`/admin/hr/employees/${ev.employee_id}`} className="block py-2 text-sm hover:text-primary">
                <div className="flex justify-between gap-2"><span className="font-medium">{ev.event_title}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(ev.created_at)}</span></div>
                <div className="text-xs text-muted-foreground">{nameOf[ev.employee_id] || ''} {ev.description ? `· ${ev.description}` : ''}</div>
              </Link>
            ))}
            {events.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          </CardContent>
        </Card>
      </div>
      <div className="hidden"><Badge className={statusClass('active')}>{label('active')}</Badge></div>
    </div>
  );
}
