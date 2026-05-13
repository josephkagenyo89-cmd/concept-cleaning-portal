import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckCircle2, X, CalendarClock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Followup {
  id: string; followup_type: string; scheduled_date: string; status: string; notes: string | null;
}

export default function PestFollowupsManager({ jobId }: { jobId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Followup[]>([]);
  const [type, setType] = useState('followup');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    const { data } = await (supabase as any).from('pest_followups').select('*').eq('pest_job_id', jobId).order('scheduled_date');
    setItems((data as Followup[]) || []);
  };
  useEffect(() => { load(); }, [jobId]);

  const add = async () => {
    if (!date) return toast({ title: 'Pick a date', variant: 'destructive' });
    const { error } = await (supabase as any).from('pest_followups').insert({
      pest_job_id: jobId, followup_type: type, scheduled_date: date, notes, created_by: user!.id,
    });
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setDate(''); setNotes(''); load();
  };

  const setStatus = async (id: string, status: string) => {
    await (supabase as any).from('pest_followups').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', id);
    load();
  };

  return (
    <div className="space-y-3">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Schedule a follow-up</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div>
            <Label>Type</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="followup">Follow-up</option>
              <option value="reinspection">Re-inspection</option>
              <option value="retreatment">Retreatment</option>
            </select>
          </div>
          <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Schedule</Button>
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Upcoming & Past</h3>
        {items.length === 0 ? <p className="text-sm text-muted-foreground">None scheduled.</p> : items.map((f) => (
          <div key={f.id} className="rounded border p-3 flex items-center justify-between gap-2 text-sm">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{f.followup_type}</Badge>
                <span className="font-medium">{f.scheduled_date}</span>
                <Badge variant={f.status === 'completed' ? 'default' : 'secondary'}>{f.status}</Badge>
              </div>
              {f.notes && <p className="text-xs text-muted-foreground mt-1">{f.notes}</p>}
            </div>
            {f.status === 'scheduled' && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setStatus(f.id, 'completed')}><CheckCircle2 className="h-3 w-3 mr-1" /> Done</Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus(f.id, 'cancelled')}><X className="h-3 w-3" /></Button>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
