import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

export default function AdminServices() {
  const [services, setServices] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', description: '', base_price: '' });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('services').select('*').order('created_at', { ascending: false });
    setServices(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setLoading(true);
    const { error } = await supabase.from('services').insert({
      name: form.name,
      description: form.description,
      base_price: Number(form.base_price),
    });
    setLoading(false);
    if (error) { toast({ title: 'Failed', variant: 'destructive' }); return; }
    toast({ title: 'Service created!' });
    setForm({ name: '', description: '', base_price: '' });
    setOpen(false);
    load();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    await supabase.from('services').update({ is_active: !is_active }).eq('id', id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Services</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Service</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Service</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Deep Cleaning" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Full house deep clean" /></div>
              <div><Label>Base Price (Ksh)</Label><Input type="number" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} placeholder="5000" /></div>
              <Button onClick={handleCreate} disabled={loading || !form.name || !form.base_price} className="w-full">
                {loading ? 'Creating...' : 'Create Service'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {services.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No services yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {services.map(s => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                  <p className="text-sm font-medium mt-1">Ksh {Number(s.base_price).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{s.is_active ? 'Active' : 'Inactive'}</span>
                  <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
