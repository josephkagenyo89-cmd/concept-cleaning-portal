import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Layers, Plus, Trash2, Check, Pencil, X } from 'lucide-react';
import {
  ServiceCategory,
  createServiceCategory,
  deleteServiceCategory,
  fetchServiceCategories,
  updateServiceCategory,
} from '@/lib/serviceCategories';

interface Props {
  serviceCounts: Record<string, number>;
  onChanged: () => void;
}

/** ERP → Services → Categories: admins manage the category list used everywhere. */
export default function ServiceCategoriesDialog({ serviceCounts, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ServiceCategory[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = async () => setRows(await fetchServiceCategories());

  useEffect(() => { if (open) load(); }, [open]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [rows]
  );

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await createServiceCategory(name, undefined, sorted.length + 1);
    setBusy(false);
    if (error) { toast({ title: 'Could not add category', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Category added' });
    setName('');
    await load();
    onChanged();
  };

  const rename = async (row: ServiceCategory) => {
    if (!editName.trim() || editName === row.name) { setEditId(null); return; }
    const { error } = await updateServiceCategory(row.id, { name: editName.trim() });
    if (error) { toast({ title: 'Rename failed', description: error.message, variant: 'destructive' }); return; }
    setEditId(null);
    await load();
    onChanged();
  };

  const toggle = async (row: ServiceCategory) => {
    await updateServiceCategory(row.id, { is_active: !row.is_active });
    await load();
    onChanged();
  };

  const remove = async (row: ServiceCategory) => {
    if ((serviceCounts[row.name] || 0) > 0) {
      toast({
        title: 'Category in use',
        description: `${serviceCounts[row.name]} service(s) still use "${row.name}". Move them first or deactivate the category.`,
        variant: 'destructive',
      });
      return;
    }
    const { error } = await deleteServiceCategory(row.id);
    if (error) { toast({ title: 'Delete failed', description: error.message, variant: 'destructive' }); return; }
    await load();
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Layers className="mr-2 h-4 w-4" /> Categories</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Service Categories</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>New category</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Post-Construction Cleaning" />
            </div>
            <Button onClick={add} disabled={busy || !name.trim()}><Plus className="mr-2 h-4 w-4" /> Add</Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {editId === row.id ? (
                        <div className="flex items-center gap-1">
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => rename(row)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="font-medium">{row.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{serviceCounts[row.name] || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={row.is_active} onCheckedChange={() => toggle(row)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => { setEditId(row.id); setEditName(row.name); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(row)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Categories drive the ERP service form, the customer portal listings and category pages. Existing services keep
            their category — deactivate instead of deleting if a category is still in use.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
