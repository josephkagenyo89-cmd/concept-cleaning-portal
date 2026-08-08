import { useEffect, useRef, useState } from 'react';
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
import { Plus, Pencil, BadgeCheck, Upload, Download, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { downloadServicesCsv, downloadServicesPdf, importServicesCsv } from '@/lib/servicesIo';


const CATEGORIES = [
  'Residential Cleaning',
  'Upholstery Cleaning',
  'Carpet & Rug Cleaning',
  'Car Interior Cleaning',
  'Commercial Cleaning',
  'Fumigation & Pest Control',
];

interface FormState {
  name: string;
  description: string;
  base_price: string;
  category: string;
  commission_eligible: boolean;
}

const defaultForm: FormState = {
  name: '', description: '', base_price: '', category: CATEGORIES[0],
  commission_eligible: true,
};

export default function AdminServices() {
  const [services, setServices] = useState<any[]>([]);
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(CATEGORIES[0]);

  const load = async () => {
    const { data } = await supabase.from('services').select('*').order('name');
    setServices(data || []);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setForm({ ...defaultForm, category: activeTab }); setEditId(null); };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (s: any) => {
    setForm({
      name: s.name,
      description: s.description || '',
      base_price: String(s.base_price),
      category: s.category || CATEGORIES[0],
      commission_eligible: s.commission_eligible ?? true,
    });
    setEditId(s.id);
    setOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    const payload: any = {
      name: form.name,
      description: form.description,
      base_price: Number(form.base_price) || 0,
      category: form.category,
      commission_eligible: form.commission_eligible,
      pricing_model: 'fixed',
      pricing_unit: 'fixed',
      input_type: 'number',
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
              <div><Label>Service Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sofa Cleaning – 3 Seater" /></div>
              <div><Label>Description (optional)</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" /></div>
              <div><Label>Base Price (Ksh)</Label><Input type="number" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} placeholder="2500" /></div>
              <div className="flex items-center justify-between">
                <Label>Commission Eligible</Label>
                <Switch checked={form.commission_eligible} onCheckedChange={v => setForm(f => ({ ...f, commission_eligible: v }))} />
              </div>
              <Button onClick={handleSave} disabled={loading || !form.name} className="w-full">
                {loading ? 'Saving...' : editId ? 'Update Service' : 'Create Service'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full mb-4">
          <TabsList className="inline-flex w-max">
            {CATEGORIES.map(c => (
              <TabsTrigger key={c} value={c} className="text-xs sm:text-sm whitespace-nowrap">{c}</TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

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
                          <TableCell>{Number(s.base_price) > 0 ? Number(s.base_price).toLocaleString() : <span className="text-muted-foreground">Not set</span>}</TableCell>
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
