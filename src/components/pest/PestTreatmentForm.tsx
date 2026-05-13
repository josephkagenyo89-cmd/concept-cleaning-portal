import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Treatment {
  id: string; treatment_method: string | null; equipment_used: string | null; ppe_used: string | null;
  safety_instructions: string | null; client_acknowledged: boolean; performed_at: string;
}
interface Chemical {
  id: string; chemical_name: string; dosage: string | null; quantity: number; unit: string | null; used_on: string;
}

export default function PestTreatmentForm({ jobId }: { jobId: string }) {
  const { user, profile } = useAuth();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [t, setT] = useState({ treatment_method: '', equipment_used: '', ppe_used: '', safety_instructions: '', client_acknowledged: false });
  const [c, setC] = useState({ chemical_name: '', dosage: '', quantity: '', unit: 'ml' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: tr }, { data: ch }] = await Promise.all([
      (supabase as any).from('pest_treatments').select('*').eq('pest_job_id', jobId).order('performed_at', { ascending: false }),
      (supabase as any).from('pest_chemical_usage').select('*').eq('pest_job_id', jobId).order('used_on', { ascending: false }),
    ]);
    setTreatments((tr as Treatment[]) || []);
    setChemicals((ch as Chemical[]) || []);
  };
  useEffect(() => { load(); }, [jobId]);

  const addTreatment = async () => {
    setSaving(true);
    const { error } = await (supabase as any).from('pest_treatments').insert({
      pest_job_id: jobId, ...t, performed_by: user!.id, performed_by_name: profile?.full_name,
    });
    setSaving(false);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setT({ treatment_method: '', equipment_used: '', ppe_used: '', safety_instructions: '', client_acknowledged: false });
    load();
  };

  const addChemical = async () => {
    if (!c.chemical_name) return toast({ title: 'Chemical name required', variant: 'destructive' });
    setSaving(true);
    const { error } = await (supabase as any).from('pest_chemical_usage').insert({
      pest_job_id: jobId, chemical_name: c.chemical_name, dosage: c.dosage,
      quantity: Number(c.quantity) || 0, unit: c.unit,
      technician_id: user!.id, technician_name: profile?.full_name,
    });
    setSaving(false);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    setC({ chemical_name: '', dosage: '', quantity: '', unit: 'ml' });
    load();
  };

  const remove = async (table: string, id: string) => {
    await (supabase as any).from(table).delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Add Treatment Record</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Treatment method</Label><Input value={t.treatment_method} onChange={(e) => setT({ ...t, treatment_method: e.target.value })} placeholder="Spraying, fogging, baiting…" /></div>
          <div><Label>Equipment used</Label><Input value={t.equipment_used} onChange={(e) => setT({ ...t, equipment_used: e.target.value })} placeholder="Sprayer, fogger…" /></div>
          <div><Label>PPE used</Label><Input value={t.ppe_used} onChange={(e) => setT({ ...t, ppe_used: e.target.value })} placeholder="Gloves, mask, overalls…" /></div>
          <div className="flex items-end gap-2">
            <Checkbox id="ack" checked={t.client_acknowledged} onCheckedChange={(v) => setT({ ...t, client_acknowledged: !!v })} />
            <Label htmlFor="ack" className="cursor-pointer">Client acknowledged safety briefing</Label>
          </div>
        </div>
        <div><Label>Safety instructions to client</Label><Textarea value={t.safety_instructions} onChange={(e) => setT({ ...t, safety_instructions: e.target.value })} /></div>
        <Button onClick={addTreatment} disabled={saving}><Plus className="h-4 w-4 mr-1" /> Add Treatment</Button>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Recorded Treatments</h3>
        {treatments.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : treatments.map((tr) => (
          <div key={tr.id} className="rounded border p-3 text-sm flex justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">{tr.treatment_method || 'Treatment'}</p>
              <p className="text-xs text-muted-foreground">Equipment: {tr.equipment_used || '—'} · PPE: {tr.ppe_used || '—'}</p>
              {tr.safety_instructions && <p className="text-xs mt-1">{tr.safety_instructions}</p>}
              <p className="text-xs text-muted-foreground mt-1">{tr.client_acknowledged ? '✓ Client acknowledged' : '✗ Not acknowledged'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove('pest_treatments', tr.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Add Chemical Usage</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="col-span-2"><Label>Chemical name</Label><Input value={c.chemical_name} onChange={(e) => setC({ ...c, chemical_name: e.target.value })} /></div>
          <div><Label>Dosage</Label><Input value={c.dosage} onChange={(e) => setC({ ...c, dosage: e.target.value })} placeholder="e.g. 5ml/L" /></div>
          <div><Label>Quantity</Label><Input type="number" value={c.quantity} onChange={(e) => setC({ ...c, quantity: e.target.value })} /></div>
          <div><Label>Unit</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={c.unit} onChange={(e) => setC({ ...c, unit: e.target.value })}>
              {['ml', 'l', 'g', 'kg', 'units'].map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <Button onClick={addChemical} disabled={saving}><Plus className="h-4 w-4 mr-1" /> Add Chemical</Button>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Chemicals Used</h3>
        {chemicals.length === 0 ? <p className="text-sm text-muted-foreground">None recorded.</p> : chemicals.map((ch) => (
          <div key={ch.id} className="rounded border p-3 text-sm flex justify-between gap-2">
            <div>
              <p className="font-medium">{ch.chemical_name} {ch.dosage && <span className="text-muted-foreground">({ch.dosage})</span>}</p>
              <p className="text-xs text-muted-foreground">{ch.quantity} {ch.unit} · {ch.used_on}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove('pest_chemical_usage', ch.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </Card>
    </div>
  );
}
