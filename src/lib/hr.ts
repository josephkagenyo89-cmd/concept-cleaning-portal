import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Employee = Database['public']['Tables']['employees']['Row'];
export type EmployeeInsert = Database['public']['Tables']['employees']['Insert'];
export type Department = Database['public']['Tables']['hr_departments']['Row'];
export type Position = Database['public']['Tables']['hr_positions']['Row'];
export type EmploymentRecord = Database['public']['Tables']['employee_employment']['Row'];
export type TimelineEvent = Database['public']['Tables']['employee_timeline']['Row'];

export const EMPLOYMENT_TYPES = ['permanent', 'contract', 'casual', 'part_time', 'intern', 'probation'] as const;
export const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'suspended', 'inactive', 'terminated'] as const;
export const GENDERS = ['male', 'female', 'other'] as const;
export const MARITAL = ['single', 'married', 'divorced', 'widowed'] as const;

export const label = (v?: string | null) =>
  v ? v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—';

export const statusClass = (s?: string | null) => {
  switch (s) {
    case 'active': return 'bg-success/15 text-success border-success/30';
    case 'on_leave': return 'bg-info/15 text-info border-info/30';
    case 'suspended': return 'bg-warning/15 text-warning border-warning/30';
    case 'inactive':
    case 'terminated': return 'bg-muted text-muted-foreground border-border';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export async function loadHrLookups() {
  const [d, p, e] = await Promise.all([
    supabase.from('hr_departments').select('*').order('name'),
    supabase.from('hr_positions').select('*').order('title'),
    supabase.from('employees').select('id, full_name, employee_code, employment_status').order('full_name'),
  ]);
  return {
    departments: (d.data || []) as Department[],
    positions: (p.data || []) as Position[],
    managers: (e.data || []) as Pick<Employee, 'id' | 'full_name' | 'employee_code' | 'employment_status'>[],
  };
}
