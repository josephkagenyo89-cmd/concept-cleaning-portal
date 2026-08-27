import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, BadgeCheck, Upload, Download, FileText, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadServicesCsv, downloadServicesPdf } from '@/lib/servicesIo';
import ServiceCategoriesDialog from '@/components/admin/ServiceCategoriesDialog';
import { FALLBACK_CATEGORIES, fetchCategoryNames } from '@/lib/serviceCategories';
import { ImportServicesModal } from '../../components/admin/ImportServicesModal';

interface FormState {
  name: string;
  description: string;
  base_price: string;
  category: string;
  commission_eligible: boolean;
}

const defaultForm: FormState = {
  name: '', description: '', base_price: '', category: '',
  commission_eligible: true,
};

export default function AdminServices() {
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('services').select('*').order('name');
    setServices(data || []);
  };

  const loadCategories = async () => {
    const names = await fetchCategoryNames();
    setCategories(names.length ? names : FALLBACK_CATEGORIES);
    setActiveTab((prev) => (prev && names.includes(prev) ? prev : names[0] || FALLBACK_CATEGORIES[0]));
  };

  useEffect(() => { load(); loadCategories(); }, []);

  const tabs = useMemo(() => {
    const extra = Array.from(new Set(services.map((s) => s.category).filter(Boolean)))
      .filter((c) => !categories.includes(c as string)) as string[];
    return [...categories, ...extra];
  }, [categories, services]);

  const serviceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    services.forEach((s) => { counts[s.category] = (counts[s.category] || 0) + 1; });
    return counts;
  }, [services]);

  const totalServices = services.length;
  const totalCategories = tabs.length;
  const activeServices = services.filter(s => s.is_active).length;

  const resetForm = () => { setForm({ ...defaultForm, category: activeTab || tabs[0] || '' }); setEditId(null); };

  const openCreate = () => { resetForm(); setOpen(true); };

  const openEdit = (s: any) => {
    setForm({
      name: s.name,
      description: s.description || '',
      base_price: String(s.base_price),
      category: s.category || tabs[0] || '',
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
    toast({ title: editId ? 'Service updated!' : 'Service created!', description: editId ? undefined : 'A unique service code was generated automatically.' });
    resetForm();
    setOpen(false);
    load();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    await supabase.from('services').update({ is_active: !is_active }).eq('id', id);
    load();
  };

  // Filter: category + search + active status
  const filtered = services.filter(s => {
    const matchesCategory = s.category === activeTab;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesActive = showInactive ? true : s.is_active === true;
    return matchesCategory && matchesSearch && matchesActive;
  });

  return (
    <div>
      {/* Header with stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Master Service</h1>
          <p className="text-sm text-muted-foreground">Manage your service catalog</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ServiceCategoriesDialog serviceCounts={serviceCounts} onChanged={loadCategories} />
          <Button variant="outline" size="sm" onClick={() => setImportModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadServicesCsv(services as any)}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadServicesPdf(services as any)}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Service</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editId ? 'Edit Service' : 'New Service'}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                    <SelectContent>{tabs.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">Manage the list from the “Categories” button.</p>
                </div>
                <div><Label>Service Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sofa Cleaning – 3 Seater" /></div>
                <div><Label>Description (optional)</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" /></div>
                <div><Label>Base Price (Ksh)</Label><Input type="number" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))} placeholder="2500" /></div>
                <div className="flex items-center justify-between">
                  <Label>Commission Eligible</Label>
                  <Switch checked={form.commission_eligible} onCheckedChange={v => setForm(f => ({ ...f, commission_eligible: v }))} />
                </div>
                <Button onClick={handleSave} disabled={loading || !form.name || !form.category} className="w-full">
                  {loading ? 'Saving...' : editId ? 'Update Service' : 'Create Service'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="py-4 flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Total Services</span>
            <span className="text-2xl font-bold">{totalServices}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Categories</span>
            <span className="text-2xl font-bold">{totalCategories}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Active Services</span>
            <span className="text-2xl font-bold">{activeServices}</span>
          </CardContent>
        </Card>
      </div>

      <ImportServicesModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => {
          load();
          loadCategories();
        }}
      />

      {/* Category dropdown + search + show inactive toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Category:</span>
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {tabs.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">({filtered.length} services)</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
              Show inactive
            </Label>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Service table */}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No services match your filters</CardContent></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="w-[120px]">Price (Ksh)</TableHead>
                  <TableHead className="w-[120px]">Commission</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s, idx) => (
                  <TableRow key={s.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{s.service_code || '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{s.name}</p>
                        {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {Number(s.base_price) > 0 ? Number(s.base_price).toLocaleString() : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {s.commission_eligible ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-none">
                          <BadgeCheck className="h-3 w-3 mr-1" /> Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="border-none">No</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
                        <span className="text-xs text-muted-foreground">
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
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
    </div>
  );
}
