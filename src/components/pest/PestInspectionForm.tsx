import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

export default function PestInspectionForm({ jobId }: { jobId: string }) {
  const [data, setData] = useState({
    pest_type: '', infestation_level: 'low', affected_areas: '', client_observations: '', technician_notes: '',
  });
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: row } = await (supabase as any).from('pest_inspections').select('*').eq('pest_job_id', jobId).maybeSingle();
      if (row) {
        setExistingId(row.id);
        setData({
          pest_type: row.pest_type || '',
          infestation_level: row.infestation_level || 'low',
          affected_areas: row.affected_areas || '',
          client_observations: row.client_observations || '',
          technician_notes: row.technician_notes || '',
        });
      }
    })();
  }, [jobId]);

  const save = async () => {
    setSaving(true);
    const payload = { ...data, pest_job_id: jobId };
    let error;
    if (existingId) {
      ({ error } = await (supabase as any).from('pest_inspections').update(payload).eq('id', existingId));
    } else {
      const { data: row, error: e } = await (supabase as any).from('pest_inspections').insert(payload).select('id').single();
      error = e;
      if (row) setExistingId((row as any).id);
    }
    setSaving(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Inspection saved' });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Pest type</Label>
          <Input value={data.pest_type} onChange={(e) => setData({ ...data, pest_type: e.target.value })} />
        </div>
        <div>
          <Label>Infestation level</Label>
          <select className="w-full h-10 rounded-md border bg-background px-3 text-sm"
            value={data.infestation_level} onChange={(e) => setData({ ...data, infestation_level: e.target.value })}>
            {['low', 'medium', 'high', 'severe'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label>Affected areas</Label>
        <Input value={data.affected_areas} onChange={(e) => setData({ ...data, affected_areas: e.target.value })} placeholder="e.g. Kitchen, store room, bedrooms" />
      </div>
      <div>
        <Label>Client observations</Label>
        <Textarea value={data.client_observations} onChange={(e) => setData({ ...data, client_observations: e.target.value })} />
      </div>
      <div>
        <Label>Technician notes</Label>
        <Textarea value={data.technician_notes} onChange={(e) => setData({ ...data, technician_notes: e.target.value })} />
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save Inspection
      </Button>
    </Card>
  );
}
