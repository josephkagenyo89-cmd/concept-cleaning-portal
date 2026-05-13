import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Area { id: string; area_name: string; notes: string | null; }

export default function PestAreasManager({ jobId }: { jobId: string }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    const { data } = await (supabase as any).from('pest_areas_treated').select('*').eq('pest_job_id', jobId).order('created_at');
    setAreas((data as Area[]) || []);
  };
  useEffect(() => { load(); }, [jobId]);

  const add = async () => {
    if (!name.trim()) return toast({ title: 'Area name required', variant: 'destructive' });
    const { error } = await (supabase as any).from('pest_areas_treated').insert({ pest_job_id: jobId, area_name: name, notes });
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setName(''); setNotes(''); load();
  };
  const remove = async (id: string) => { await (supabase as any).from('pest_areas_treated').delete().eq('id', id); load(); };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-col md:flex-row gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Area / room name" />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
        <Button onClick={add}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      {areas.length === 0 ? <p className="text-sm text-muted-foreground">No areas recorded yet.</p> :
        <div className="space-y-2">
          {areas.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <div>
                <p className="font-medium">{a.area_name}</p>
                {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      }
    </Card>
  );
}
