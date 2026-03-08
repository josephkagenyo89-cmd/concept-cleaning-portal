import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Tag, DollarSign, BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CATEGORIES = ['Cleaning Services', 'Upholstery & Carpet Cleaning', 'Car Detailing'];
const PRICING_MODELS: { value: string; label: string }[] = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'variation', label: 'Variation-Based' },
  { value: 'per_unit', label: 'Per Unit' },
];

export default function AdminServices() {
  const [services, setServices] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', description: '', base_price: '', category: CATEGORIES[0], pricing_model: 'fixed', commission_eligible: true, requires_size_input: false, price_per_sqm: '' });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(CATEGORIES[0]);

  const load = async () => {
    const { data } = await supabase.from('services').select('*').order('name');
    setServices(data || []);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', base_price: '', category: activeTab, pricing_model: 'fixed', commission_eligible: true, requires_size_input: false, price_per_sqm: '' });
    setEditId(null);
  };

  const openCreate = () => {
    resetForm();
    setForm(f => ({ ...f, category: activeTab }));
    setOpen(true);
  };

  const openEdit = (s: any) => {
    setForm({
      name: s.name,
      description: s.description || '',
      base_price: String(s.base_price),
      category: s.category || CATEGORIES[0],
      pricing_model: s.pricing_model || 'fixed',
      commission_eligible: s.commission_eligible ?? true,
      requires_size_input: s.requires_size_input ?? false,
      price_per_sqm: s.price_per_sqm ? String(s.price_per_sqm) : '',
    });
    setEditId(s.id);
    setOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload = {
      name: form.name,
      description: form.description,
      base_price: Number(form.base_price),
      category: form.category,
      pricing_model: form.pricing_model,
      commission_eligible: form.commission_eligible,
      requires_size_input: form.requires_size_input,
      price_per_sqm: form.requires_size_input ? Number(form.price_per_sqm) || 0 : 0,
    };

    const { error } = editId
      ? await supabase.from('services').update(payload).eq('id', editId)
      : await supabase.from('services').insert(payload);

    setLoading(false);
    if (error) { toast({ title: 'Failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editId ? 'Service updated!' : 'Service created!' });
    resetForm();
    setOpen(false);
    load();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    await supabase.from('services').update({ is_active: !is_active }).eq('id', id);
    load();
  };

  const pricingLabel = (model: string) => PRICING_MODELS.find(p => p.value === model)?.label || model;

  const filtered = services.filter(s => s.category === activeTab);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Services</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Service</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? 'Edit Service' : 'New Service'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 3 Bedroom Cleaning" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" /></div>
              <div><Label>Base Price (Ksh)</Label><Input type="number" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} placeholder="5000" /></div>
              <div><Label>Pricing Model</Label>
                <Select value={form.pricing_model} onValueChange={v => setForm(f => ({ ...f, pricing_model: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRICING_MODELS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Commission Eligible</Label>
                <Switch checked={form.commission_eligible} onCheckedChange={v => setForm(f => ({ ...f, commission_eligible: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Requires Size Input (m²)</Label>
                <Switch checked={form.requires_size_input} onCheckedChange={v => setForm(f => ({ ...f, requires_size_input: v }))} />
              </div>
              {form.requires_size_input && (
                <div><Label>Price per m² (Ksh)</Label><Input type="number" value={form.price_per_sqm} onChange={e => setForm(f => ({ ...f, price_per_sqm: e.target.value }))} placeholder="150" /></div>
              )}
              <Button onClick={handleSave} disabled={loading || !form.name} className="w-full">
                {loading ? 'Saving...' : editId ? 'Update Service' : 'Create Service'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-4">
          {CATEGORIES.map(c => (
            <TabsTrigger key={c} value={c} className="flex-1 text-xs sm:text-sm">
              {c}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map(cat => (
          <TabsContent key={cat} value={cat}>
            {filtered.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-muted-foreground">No services in this category</CardContent></Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Price (Ksh)</TableHead>
                        <TableHead>Pricing</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(s => (
                        <TableRow key={s.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{s.name}</p>
                              {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{Number(s.base_price) > 0 ? Number(s.base_price).toLocaleString() : '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />{pricingLabel(s.pricing_model || 'fixed')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {s.commission_eligible ? (
                              <Badge className="bg-primary/10 text-primary text-xs"><BadgeCheck className="h-3 w-3 mr-1" />Yes</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
