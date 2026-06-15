import { Check, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import type { SaveStatus } from '@/hooks/useAutoSaveDraft';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  status: SaveStatus;
  lastSavedAt: Date | null;
  bookingCode?: string | null;
  bookingStatus?: string;
}

export default function DraftStatusBadge({ status, lastSavedAt, bookingCode, bookingStatus }: Props) {
  const icon =
    status === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> :
    status === 'saved' ? <Check className="h-3 w-3 text-emerald-600" /> :
    status === 'queued' ? <CloudOff className="h-3 w-3 text-amber-600" /> :
    status === 'error' ? <AlertTriangle className="h-3 w-3 text-destructive" /> :
    null;

  const label =
    status === 'saving' ? 'Saving…' :
    status === 'saved' ? `Saved${lastSavedAt ? ` · ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}` : ''}` :
    status === 'queued' ? 'Offline — queued' :
    status === 'error' ? 'Save failed' :
    'Auto-save enabled';

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 rounded-md border bg-card px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-mono font-semibold text-foreground">
          {bookingCode || 'Draft (syncing…)'}
        </span>
        {bookingStatus && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {bookingStatus}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
    </div>
  );
}
