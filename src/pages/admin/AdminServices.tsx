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
import { Plus, Pencil, Tag, BadgeCheck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const CATEGORIES = ['Cleaning Services', 'Upholstery & Carpet Cleaning', 'Car Detailing'];
const PRICING_MODELS = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'variation', label: 'Variation-Based' },
  { value: 'per_unit', label: 'Per Unit' },
];
const PRICING_UNITS = [
  { value: 'fixed', label: 'Fixed (no quantity)' },
  { value: 'per_sqft', label: 'Per Square Foot' },
  { value: 'per_sqm', label: 'Per Square Meter' },
  { value: 'per_unit', label: 'Per Unit' },
];
const INPUT_TYPES = [
  { value: 'number', label: 'Number Input' },
  { value: 'dropdown', label: 'Dropdown Options' },
];

interface FormState {
  name: string;
  description: string;
  base_price: string;
  category: string;
  pricing_model: string;
  commission_eligible: boolean;
  requires_size_input: boolean;
  price_per_sqm: string;
  input_type: string;
  dropdown_options: string[];
  pricing_unit: string;
}

const defaultForm: FormState = {
  name: '', description: '', base_price: '', category: CATEGORIES[0],
  pricing_model: 'fixed', commission_eligible: true, requires_size_input: false,
  price_per_sqm: '', input_type: 'number', dropdown_options: [], pricing_unit: 'fixed',
};

export default function AdminServices() {
  const [services, setServices] = useState<any[]>([]);
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(CATEGORIES[0]);
  const [newOption, setNewOption] = useState('');

  const load = async () => {
    const { data } = await supabase.from('services').select('*').order('name');
    setServices(data || []);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setForm({ ...defaultForm, category: activeTab }); setEditId(null); setNewOption(''); };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (s: any) => {
    let opts: string[] = [];
    try {
      if (Array.isArray(s.dropdown_options)) opts = s.dropdown_options.map(String);
      else if (typeof s.dropdown_options === 'string') opts = JSON.parse(s.dropdown_options);
    } catch { opts = []; }

    setForm({
      name: s.name,
      description: s.description || '',
      base_price: String(s.base_price),
      category: s.category || CATEGORIES[0],
      pricing_model: s.pricing_model || 'fixed',
      commission_eligible: s.commission_eligible ?? true,
      requires_size_input: s.requires_size_input ?? false,
      price_per_sqm: s.price_per_sqm ? String(s.price_per_sqm) : '',
      input_type: s.input_type || 'number',
      dropdown_options: opts,
      pricing_unit: s.pricing_unit || 'fixed',
    });
    setEditId(s.id);
    setOpen(true);
  };

  const addOption = () => {
    const trimmed = newOption.trim();
    if (trimmed && !form.dropdown_options.includes(trimmed)) {
      setForm(f => ({ ...f, dropdown_options: [...f.dropdown_options, trimmed] }));
    }
    setNewOption('');
  };

  const removeOption = (opt: string) => {
    setForm(f => ({ ...f, dropdown_options: f.dropdown_options.filter(o => o !== opt) }));
  };

  const handleSave = async () => {
    setLoading(true);
    const payload: any = {
      name: form.name,
      description: form.description,
      base_price: Number(form.base_price),
      category: form.category,
      pricing_model: form.pricing_model,
      commission_eligible: form.commission_eligible,
      requires_size_input: form.requires_size_input,
      price_per_sqm: form.requires_size_input || form.pricing_unit !== 'fixed' ? Number(form.price_per_sqm) || 0 : 0,
      input_type: form.input_type,
      dropdown_options: form.input_type === 'dropdown' ? form.dropdown_options : [],
      pricing_unit: form.pricing_unit,
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
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? 'Edit Service' : 'New Service'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Carpet Cleaning" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" /></div>
              <div><Label>Base Price (Ksh)</Label><Input type="number" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} placeholder="5000" /></div>
              
              <div><Label>Pricing Unit</Label>
                <Select value={form.pricing_unit} onValueChange={v => setForm(f => ({ ...f, pricing_unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRICING_UNITS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {form.pricing_unit !== 'fixed' && (
                <div><Label>Rate per Unit (Ksh)</Label><Input type="number" value={form.price_per_sqm} onChange={e => setForm(f => ({ ...f, price_per_sqm: e.target.value }))} placeholder="e.g. 40" /></div>
              )}

              <div><Label>Agent Input Type</Label>
                <Select value={form.input_type} onValueChange={v => setForm(f => ({ ...f, input_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INPUT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {form.input_type === 'dropdown' && (
                <div className="space-y-2">
                  <Label>Dropdown Options</Label>
                  <div className="flex gap-2">
                    <Input value={newOption} onChange={e => setNewOption(e.target.value)} placeholder="Add option" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }} />
                    <Button type="button" variant="outline" size="sm" onClick={addOption}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {form.dropdown_options.map(opt => (
                      <Badge key={opt} variant="secondary" className="gap-1">
                        {opt}
                        <button type="button" onClick={() => removeOption(opt)} className="rounded-full hover:bg-muted-foreground/20">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  {form.dropdown_options.length === 0 && <p className="text-xs text-muted-foreground">Add at least one option</p>}
                </div>
              )}

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
              {form.requires_size_input && form.pricing_unit === 'fixed' && (
                <div><Label>Price per m² (Ksh)</Label><Input type="number" value={form.price_per_sqm} onChange={e => setForm(f => ({ ...f, price_per_sqm: e.target.value }))} placeholder="150" /></div>
              )}
              <Button onClick={handleSave} disabled={loading || !form.name || (form.input_type === 'dropdown' && form.dropdown_options.length === 0)} className="w-full">
                {loading ? 'Saving...' : editId ? 'Update Service' : 'Create Service'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-4">
          {CATEGORIES.map(c => (
            <TabsTrigger key={c} value={c} className="flex-1 text-xs sm:text-sm">{c}</TabsTrigger>
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
                        <TableHead>Input</TableHead>
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
                              {s.input_type === 'dropdown' ? 'Dropdown' : 'Number'}
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
