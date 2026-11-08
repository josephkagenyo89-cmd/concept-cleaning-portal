
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  Pencil,
  BadgeCheck,
  Upload,
  Download,
  FileText,
  Search,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  downloadServicesCsv,
  downloadServicesPdf,
} from '@/lib/servicesIo';
import ServiceCategoriesDialog from '@/components/admin/ServiceCategoriesDialog';
import { fetchServiceCategoriesStrict } from '@/lib/serviceCategories';
import { ImportServicesModal } from '../../components/admin/ImportServicesModal';

interface FormState {
  name: string;
  description: string;
  base_price: string;
  category: string;
  commission_eligible: boolean;
}

const ALL_SERVICES = '__all_services__';

const defaultForm: FormState = {
  name: '',
  description: '',
  base_price: '',
  category: '',
  commission_eligible: true,
};

export default function AdminServices() {
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<any | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(ALL_SERVICES);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const load = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*, service_category:service_categories!services_category_id_fkey(id, name)')
      .order('name');

    if (error) {
      toast({
        title: 'Failed to load services',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setServices(data || []);
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    setCategoryError(null);

    try {
      const result = await fetchServiceCategoriesStrict();

      if (result.error) {
        setCategories([]);
        setCategoryError(result.error.message);
        setActiveTab(ALL_SERVICES);
        return;
      }

      const activeCategories = (result.data || [])
        .filter((category) => category.is_active)
        .map((category) => category.name);

      setCategories(activeCategories);

      setActiveTab((previous) => {
        if (previous === ALL_SERVICES) return ALL_SERVICES;
        if (previous && activeCategories.includes(previous)) return previous;
        return ALL_SERVICES;
      });
    } catch (error) {
      setCategories([]);
      setActiveTab(ALL_SERVICES);
      setCategoryError(
        error instanceof Error
          ? error.message
          : 'Unable to load the official service categories.',
      );
    } finally {
      setCategoriesLoading(false);
    }
  };

  const refreshAfterCategoryChange = async () => {
    await load();
    await loadCategories();
  };

  useEffect(() => {
    void load();
    void loadCategories();
  }, []);

  // The official database catalogue is the only source for category tabs.
  const tabs = categories;

  // Keep an existing unavailable category visible while editing.
  // It cannot be saved until the user selects an active category.
  const editCategoryOptions = useMemo(() => {
    if (
      !editId ||
      !form.category ||
      categories.includes(form.category)
    ) {
      return categories;
    }

    return [form.category, ...categories];
  }, [editId, form.category, categories]);

  // Reconciliation is based on missing official category links,
  // not on whether legacy category text matches a current category name.
  const unregisteredCategories = useMemo(() => {
    return Array.from(
      new Set(
        services
          .filter((service) => service.category_id == null)
          .map((service) => service.category)
          .filter(
            (category): category is string =>
              typeof category === 'string' && Boolean(category.trim()),
          ),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [services]);

  // Preserve total counts for archive confirmations.
  const unlinkedServiceCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    services.forEach((service) => {
      const category = service.category;

      if (service.category_id == null &&
          typeof category === 'string' &&
          category.trim()) {
        counts[category] = (counts[category] || 0) + 1;
      }
    });

    return counts;
  }, [services]);

  // Count assigned services by their authoritative category UUID.
  const serviceCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    services.forEach((service) => {
      const categoryId = service.category_id;

      if (typeof categoryId === 'string' && categoryId) {
        counts[categoryId] = (counts[categoryId] || 0) + 1;
      }
    });

    return counts;
  }, [services]);

  const totalServices = services.length;
  const totalCategories = categories.length;
  const activeServices = services.filter(
    (service) => service.is_active,
  ).length;

  const resetForm = () => {
    setForm({
      ...defaultForm,
      category: activeTab || tabs[0] || '',
    });
    setEditId(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (service: any) => {
    setForm({
      name: service.name,
      description: service.description || '',
      base_price: String(service.base_price ?? ''),
      category: service.category || tabs[0] || '',
      commission_eligible: service.commission_eligible ?? true,
    });

    setEditId(service.id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (categoriesLoading || categoryError) {
      toast({
        title: 'Categories unavailable',
        description: 'Reload the official category catalogue before saving.',
        variant: 'destructive',
      });
      return;
    }

    if (!form.category || !categories.includes(form.category)) {
      toast({
        title: 'Invalid category',
        description: 'Select an active category from the official catalogue.',
        variant: 'destructive',
      });
      return;
    }

    if (!form.name.trim()) {
      toast({
        title: 'Service name required',
        description: 'Enter a service name before saving.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim(),
        base_price: Number(form.base_price) || 0,
        category: form.category,
        commission_eligible: form.commission_eligible,
        pricing_model: 'fixed',
        pricing_unit: 'fixed',
        input_type: 'number',
      };

      const { error } = editId
        ? await supabase
            .from('services')
            .update(payload)
            .eq('id', editId)
        : await supabase
            .from('services')
            .insert(payload);

      if (error) {
        toast({
          title: 'Failed',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: editId ? 'Service updated!' : 'Service created!',
        description: editId
          ? undefined
          : 'A unique service code was generated automatically.',
      });

      setOpen(false);
      resetForm();
      await load();
    } catch (error) {
      toast({
        title: 'Failed',
        description:
          error instanceof Error ? error.message : 'Unable to save service.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete || deletingServiceId) return;

    const service = serviceToDelete;
    setDeletingServiceId(service.id);

    try {
      const { data, error } = await supabase
        .from('services')
        .delete()
        .eq('id', service.id)
        .select('id')
        .maybeSingle();

      if (error) {
        toast({
          title: 'Service could not be deleted',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      if (!data) {
        toast({
          title: 'Service was not deleted',
          description:
            'The service may not exist or your account may not have permission to delete it.',
          variant: 'destructive',
        });
        return;
      }

      setServiceToDelete(null);

      toast({
        title: 'Service deleted',
        description: `${service.name} was permanently deleted.`,
      });

      await load();
    } catch (error) {
      toast({
        title: 'Service could not be deleted',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while deleting the service.',
        variant: 'destructive',
      });
    } finally {
      setDeletingServiceId(null);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('services')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Status update failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    await load();
  };

  const filtered = services.filter((service) => {
    const serviceCategory = (
      service.service_category?.name || service.category || ''
    ).trim().toLocaleLowerCase();

    const selectedCategory = activeTab.trim().toLocaleLowerCase();

    const matchesCategory =
      activeTab === ALL_SERVICES ||
      serviceCategory === selectedCategory;

    const matchesSearch =
      service.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesActive = showInactive || service.is_active === true;

    return matchesCategory && matchesSearch && matchesActive;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Master Service</h1>
          <p className="text-sm text-muted-foreground">
            Manage your service catalog
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <ServiceCategoriesDialog
            serviceCounts={serviceCounts}
            unlinkedServiceCounts={unlinkedServiceCounts}
            onChanged={refreshAfterCategoryChange}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportModalOpen(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadServicesCsv(services as any)}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadServicesPdf(services as any)}
          >
            <FileText className="mr-2 h-4 w-4" />
            PDF
          </Button>

          <Dialog
            open={open}
            onOpenChange={(value) => {
              setOpen(value);
              if (!value) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Service
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editId ? 'Edit Service' : 'New Service'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div>
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        category: value,
                      }))
                    }
                    disabled={
                      categoriesLoading ||
                      Boolean(categoryError) ||
                      categories.length === 0
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>

                    <SelectContent>
                      {editCategoryOptions.map((category) => {
                        const isUnavailable = !categories.includes(category);

                        return (
                          <SelectItem key={category} value={category}>
                            {isUnavailable
                              ? `${category} (inactive or unregistered — reassign)`
                              : category}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Manage the list from the Categories button.
                  </p>
                </div>

                <div>
                  <Label>Service Name</Label>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="e.g. Sofa Cleaning – 3 Seater"
                  />
                </div>

                <div>
                  <Label>Description (optional)</Label>
                  <Input
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Brief description"
                  />
                </div>

                <div>
                  <Label>Base Price (Ksh)</Label>
                  <Input
                    type="number"
                    value={form.base_price}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        base_price: event.target.value,
                      }))
                    }
                    placeholder="2500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Commission Eligible</Label>
                  <Switch
                    checked={form.commission_eligible}
                    onCheckedChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        commission_eligible: value,
                      }))
                    }
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={
                    loading ||
                    categoriesLoading ||
                    Boolean(categoryError) ||
                    !categories.includes(form.category) ||
                    !form.name.trim()
                  }
                  className="w-full"
                >
                  {loading
                    ? 'Saving...'
                    : editId
                      ? 'Update Service'
                      : 'Create Service'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="py-4 flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">
              Total Services
            </span>
            <span className="text-2xl font-bold">{totalServices}</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">
              Service Category
            </span>
            <span className="text-2xl font-bold">{totalCategories}</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">
              Active Services
            </span>
            <span className="text-2xl font-bold">{activeServices}</span>
          </CardContent>
        </Card>
      </div>

      <ImportServicesModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => {
          void load();
          void loadCategories();
        }}
      />

      {/* Category loading and reconciliation notices */}
      {categoriesLoading && (
        <Card className="mb-4">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Loading official service categories...
          </CardContent>
        </Card>
      )}

      {categoryError && (
        <Card className="mb-4 border-destructive">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-destructive">
                Unable to load official categories
              </p>
              <p className="text-sm text-muted-foreground">
                {categoryError}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadCategories()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!categoriesLoading &&
        !categoryError &&
        unregisteredCategories.length > 0 && (
          <Card className="mb-4 border-amber-500/50">
            <CardContent className="p-4">
              <p className="font-medium">
                Service categories need reconciliation
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                These category values exist on service records but are not
                active in the official category catalogue. They have not been
                added automatically.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {unregisteredCategories.map((category) => (
                  <Badge key={category} variant="outline">
                    {category.trim()}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Category selector and filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Category:</span>

          <Select
            value={activeTab}
            onValueChange={setActiveTab}

          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Services" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={ALL_SERVICES}>All Services</SelectItem>
              {tabs.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">
            ({filtered.length} services)
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label
              htmlFor="show-inactive"
              className="text-sm cursor-pointer"
            >
              Include archived services
            </Label>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      {/* Service table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No services match your search or selected filters.
          </CardContent>
        </Card>
      ) : (
        <Card className="hidden md:block overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[120px]">Code</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="w-[120px]">Price (Ksh)</TableHead>
                  <TableHead className="w-[120px]">Commission</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[80px] text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.map((service, index) => (
                  <TableRow
                    key={service.id}
                    className={
                      index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                    }
                  >
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs"
                      >
                        {service.service_code || '—'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        {service.description && (
                          <p className="text-xs text-muted-foreground">
                            {service.description}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="font-medium">
                      {Number(service.base_price) > 0 ? (
                        Number(service.base_price).toLocaleString()
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {service.commission_eligible ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-none">
                          <BadgeCheck className="h-3 w-3 mr-1" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="border-none">
                          No
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={service.is_active}
                          onCheckedChange={() =>
                            void toggleActive(
                              service.id,
                              service.is_active,
                            )
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {service.is_active ? 'Active' : 'Restore'}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2"
                          onClick={() => openEdit(service)}
                          aria-label={`Edit ${service.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setServiceToDelete(service)}
                          aria-label={`Delete ${service.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Mobile service cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {filtered.map((service) => (
            <Card key={service.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug break-words">
                      {service.name}
                    </p>
                    {service.description && (
                      <p className="mt-1 text-xs text-muted-foreground break-words">
                        {service.description}
                      </p>
                    )}
                  </div>

                  <Badge variant="outline" className="font-mono text-xs shrink-0">
                    {service.service_code || '—'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="font-semibold">
                      {Number(service.base_price) > 0
                        ? `Ksh ${Number(service.base_price).toLocaleString()}`
                        : '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Commission</p>
                    <div className="mt-1">
                      {service.commission_eligible ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-none">
                          <BadgeCheck className="h-3 w-3 mr-1" />
                          Eligible
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not eligible</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={service.is_active}
                      onCheckedChange={() =>
                        void toggleActive(service.id, service.is_active)
                      }
                      aria-label={`Change status for ${service.name}`}
                    />
                    <span className="text-sm text-muted-foreground">
                      {service.is_active ? 'Active' : 'Archived'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 px-3"
                      onClick={() => openEdit(service)}
                      aria-label={`Edit ${service.name}`}
                    >
                      <Pencil className="h-4 w-4 mr-1.5" />
                      Edit
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 px-3 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setServiceToDelete(service)}
                      aria-label={`Delete ${service.name}`}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Administrator delete confirmation */}
      <AlertDialog
        open={!!serviceToDelete}
        onOpenChange={(value) => {
          if (!value && !deletingServiceId) {
            setServiceToDelete(null);
          }
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete this service?
            </AlertDialogTitle>
            <AlertDialogDescription>
              As an administrator, you are about to permanently delete{' '}
              <strong className="text-foreground">
                {serviceToDelete?.name}
              </strong>{' '}
              from the database. This action cannot be undone. Any existing
              bookings or records linked to this service will be protected,
              and deletion will be blocked if those records prevent it.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel
              disabled={Boolean(deletingServiceId)}
              className="mt-0 w-full sm:w-auto"
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={Boolean(deletingServiceId)}
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteService();
              }}
            >
              {deletingServiceId ? 'Deleting...' : 'Yes, Delete Service'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
