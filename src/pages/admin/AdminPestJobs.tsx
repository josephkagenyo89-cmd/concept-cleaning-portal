import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Bug, Loader2 } from 'lucide-react';
import ClientSearchSelector, { SelectedClient } from '@/components/booking/ClientSearchSelector';
import { toast } from '@/hooks/use-toast';

interface PestJob {
  id: string;
  client_name: string;
  client_phone: string | null;
  pest_type: string | null;
  status: string;
  service_date: string;
  price: number;
  created_at: string;
}

export default function AdminPestJobs() {
  const { user, profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<PestJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  // create form
  const [client, setClient] = useState<SelectedClient | null>(null);
  const [pestType, setPestType] = useState('');
  const [infestation, setInfestation] = useState('low');
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('pest_jobs')
      .select('id, client_name, client_phone, pest_type, status, service_date, price, created_at')
      .order('created_at', { ascending: false });
    setJobs((data as PestJob[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = jobs.filter((j) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      j.client_name.toLowerCase().includes(q) ||
      (j.client_phone || '').includes(q) ||
      (j.pest_type || '').toLowerCase().includes(q)
    );
  });

  const handleCreate = async () => {
    if (!client) return toast({ title: 'Select a client first', variant: 'destructive' });
    if (!pestType.trim()) return toast({ title: 'Pest type required', variant: 'destructive' });
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from('pest_jobs')
      .insert({
        client_id: client.id,
        client_name: client.full_name,
        client_phone: client.phone,
        client_location: client.location,
        pest_type: pestType,
        infestation_level: infestation,
        service_date: serviceDate,
        price: Number(price) || 0,
        created_by: user!.id,
        created_by_name: profile?.full_name || 'Admin',
        created_by_role: isAdmin ? 'admin' : 'agent',
      })
      .select('id')
      .single();
    setSaving(false);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Pest job created' });
    setOpen(false);
    navigate(`/admin/pest/${(data as any).id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bug className="h-6 w-6 text-primary" /> Pest Control
          </h1>
          <p className="text-sm text-muted-foreground">Inspections, treatments, chemicals & certificates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/pest/chemicals">Chemical Log</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/pest/revisits">Revisits</Link>
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Pest Job
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jobs</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by client, phone or pest type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No pest jobs yet.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((j) => (
                <Link
                  key={j.id}
                  to={`/admin/pest/${j.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{j.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {j.pest_type || 'Pest'} · {j.service_date} · KES {Number(j.price).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={j.status === 'completed' ? 'default' : 'secondary'}>{j.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Pest Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block">Client</Label>
              <ClientSearchSelector value={client} onChange={setClient} />
            </div>
            <div>
              <Label>Pest type</Label>
              <Input value={pestType} onChange={(e) => setPestType(e.target.value)} placeholder="e.g. Cockroaches, Bedbugs, Rats" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Infestation level</Label>
                <select
                  className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                  value={infestation}
                  onChange={(e) => setInfestation(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
              <div>
                <Label>Service date</Label>
                <Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Estimated price (KES)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
