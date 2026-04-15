import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/20 text-warning-foreground border-warning/30',
  confirmed: 'bg-info/20 text-info border-info/30',
  completed: 'bg-success/20 text-success border-success/30',
  fully_confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  cancelled: 'bg-destructive/20 text-destructive border-destructive/30',
  approved: 'bg-success/20 text-success border-success/30',
  rejected: 'bg-destructive/20 text-destructive border-destructive/30',
};

const statusLabels: Record<string, string> = {
  fully_confirmed: 'Fully Confirmed',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn('capitalize', statusColors[status] || '')}>
      {statusLabels[status] || status.replace('_', ' ')}
    </Badge>
  );
}
