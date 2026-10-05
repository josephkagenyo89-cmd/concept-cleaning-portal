import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const items = [
  { to: '/admin/hr', label: 'Dashboard', end: true },
  { to: '/admin/hr/employees', label: 'Employees' },
  { to: '/admin/hr/departments', label: 'Departments' },
  { to: '/admin/hr/positions', label: 'Positions' },
  { to: '/admin/hr/payroll', label: 'Payroll' },
];

export default function HrSubNav({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Human Resources</p>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="flex gap-1 overflow-x-auto border-b">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end}
            className={({ isActive }) => cn('whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
              isActive ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {i.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
