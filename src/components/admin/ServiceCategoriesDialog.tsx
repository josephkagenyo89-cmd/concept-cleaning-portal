
import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from '@/hooks/use-toast';
import {
  Layers,
  Plus,
  Trash2,
  Pencil,
  ArrowLeft,
  Save,
  RefreshCw,
  ArrowRightLeft,
  AlertTriangle,
} from 'lucide-react';
import {
  CATEGORY_IMAGE_OPTIONS,
  categoryImage,
  invalidateCategoryImageMap,
} from '@/lib/marketplace';
import {
  ServiceCategory,
  ReconciliationService,
  createServiceCategory,
  fetchServiceCategoriesStrict,
  fetchServicesForCategoryReconciliation,
  reassignServicesToCategory,
  archiveServiceCategory,
  updateServiceCategory,
} from '@/lib/serviceCategories';

interface Props {
  serviceCounts: Record<string, number>;
  unlinkedServiceCounts: Record<string, number>;
  onChanged: () => void | Promise<void>;
}

interface CategoryForm {
  name: string;
  description: string;
  sort_order: string;
  is_active: boolean;
  image_key: string;
}

type ReconciliationAction = 'reassign';

interface ReconciliationReview {
  source: string;
  action: ReconciliationAction;
  target: string;
  targetName: string;
  services: ReconciliationService[];
}

const emptyForm: CategoryForm = {
  name: '',
  description: '',
  sort_order: '1',
  is_active: true,
  image_key: 'residential',
};

function categoryCountKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function getCategoryServiceCount(
  categoryId: string,
  categoryName: string,
  serviceCounts: Record<string, number>,
  unlinkedServiceCounts: Record<string, number>,
): number {
  const normalizedName = categoryCountKey(categoryName);
  const unlinkedCount = Object.entries(unlinkedServiceCounts).reduce(
    (total, [legacyName, count]) =>
      categoryCountKey(legacyName) === normalizedName
        ? total + count
        : total,
    0,
  );

  return (serviceCounts[categoryId] || 0) + unlinkedCount;
}

function getServiceSnapshot(services: ReconciliationService[]) {
  return services
    .map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      category_id: service.category_id,
      service_code: service.service_code,
      base_price: Number(service.base_price || 0),
      is_active: service.is_active,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export default function ServiceCategoriesDialog({
  serviceCounts,
  unlinkedServiceCounts,
  onChanged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<ServiceCategory | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [reviewing, setReviewing] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<ServiceCategory | null>(null);

  const [reconciliationSource, setReconciliationSource] = useState('');
  const [reconciliationTarget, setReconciliationTarget] = useState('');
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [reconciliationReview, setReconciliationReview] =
    useState<ReconciliationReview | null>(null);
  const [reconciliationConfirmOpen, setReconciliationConfirmOpen] =
    useState(false);

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.name.localeCompare(b.name),
      ),
    [rows],
  );

  const activeCategories = useMemo(
    () => sorted.filter((category) => category.is_active),
    [sorted],
  );

  const unregisteredCategories = useMemo(() => {
    return Object.keys(unlinkedServiceCounts)
      .filter((name) => name.trim() && (unlinkedServiceCounts[name] || 0) > 0)
      .sort((a, b) => a.localeCompare(b));
  }, [unlinkedServiceCounts]);

  const load = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await fetchServiceCategoriesStrict();

      if (result.error || !result.data) {
        setRows([]);
        setLoadError(
          result.error?.message ||
            'Could not load categories from the database.',
        );
        return;
      }

      setRows(result.data);
    } catch (error) {
      setRows([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load categories.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const refreshAfterMutation = async () => {
    await load();
    await onChanged();
  };

  const resetEditor = () => {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(false);
    setReviewing(false);
  };

  const resetReconciliation = () => {
    setReconciliationSource('');
    setReconciliationTarget('');
    setReconciliationReview(null);
    setReconciliationConfirmOpen(false);
  };

  const beginCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      sort_order: String((sorted.at(-1)?.sort_order ?? 0) + 1),
    });
    setReviewing(false);
    setEditorOpen(true);
  };

  const beginEdit = (row: ServiceCategory) => {
    setEditing(row);
    setForm({
      name: row.name,
      description: row.description || '',
      sort_order: String(row.sort_order),
      is_active: row.is_active,
      image_key: row.image_key || "residential",
    });
    setReviewing(false);
    setEditorOpen(true);
  };

  const duplicateName = rows.some(
    (row) =>
      row.name.trim().toLocaleLowerCase() ===
        form.name.trim().toLocaleLowerCase() &&
      row.id !== editing?.id,
  );

  // Preserve the exact stored name when an edit only changes surrounding whitespace.
  const effectiveCategoryName =
    editing && form.name.trim() === editing.name.trim()
      ? editing.name
      : form.name.trim();

  const validForm =
    form.name.trim().length > 0 &&
    Number.isInteger(Number(form.sort_order)) &&
    Number(form.sort_order) >= 0 &&
    !duplicateName;

  const save = async () => {
    if (!validForm || busy) return;

    setBusy(true);

    try {
      if (editing) {
        const nextName = effectiveCategoryName;

        const { error } = await updateServiceCategory(editing.id, {
          name: nextName,
          description: form.description.trim() || null,
          sort_order: Number(form.sort_order),
          is_active: form.is_active,
          image_key: form.image_key,
        });

        if (error) {
          toast({
            title: 'Category update failed',
            description: error.message,
            variant: 'destructive',
          });
          return;
        }

        invalidateCategoryImageMap();
      } else {
        const { error } = await createServiceCategory(
          effectiveCategoryName,
          form.description.trim() || undefined,
          Number(form.sort_order),
          form.image_key,
        );

        if (error) {
          toast({
            title: 'Category creation failed',
            description: error.message,
            variant: 'destructive',
          });
          return;
        }
      }

      invalidateCategoryImageMap();

      toast({
        title: editing ? 'Category updated' : 'Category created',
        description: 'The category list has been saved.',
      });

      resetEditor();
      await refreshAfterMutation();
    } catch (error) {
      toast({
        title: 'Category save failed',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || busy) return;

    setBusy(true);

    try {
      const { error } = await archiveServiceCategory(deleteTarget.id);

      if (error) {
        toast({
          title: 'Category archiving failed',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Category archived',
        description: `"${deleteTarget.name}" is now inactive. Assigned services and existing records were not changed.`,
      });

      setDeleteTarget(null);
      await refreshAfterMutation();
    } catch (error) {
      toast({
        title: 'Category archiving failed',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const beginReconciliationReview = async (
    action: ReconciliationAction,
    source: string,
    target = '',
  ) => {
    if (!source || reconciliationLoading || busy) return;

    if (action === 'reassign' && !target) {
      toast({
        title: 'Choose a destination',
        description: 'Select a different active official category.',
        variant: 'destructive',
      });
      return;
    }

    setReconciliationLoading(true);

    try {
      const result = await fetchServicesForCategoryReconciliation(source);

      if (result.error || !result.data) {
        toast({
          title: 'Could not load assigned services',
          description:
            result.error?.message ||
            'The service records could not be loaded.',
          variant: 'destructive',
        });
        return;
      }

      if (result.data.length === 0) {
        toast({
          title: 'No services found',
          description: 'This category no longer has assigned services.',
        });
        await refreshAfterMutation();
        resetReconciliation();
        return;
      }

      setReconciliationReview({
        source,
        action,
        target: action === 'reassign' ? target : '',
        targetName:
          action === 'reassign'
            ? activeCategories.find((category) => category.id === target)?.name || ''
            : '',
        services: result.data,
      });

      setReconciliationConfirmOpen(true);
    } catch (error) {
      toast({
        title: 'Could not prepare review',
        description:
          error instanceof Error
            ? error.message
            : 'Unexpected error.',
        variant: 'destructive',
      });
    } finally {
      setReconciliationLoading(false);
    }
  };

  const confirmReconciliation = async () => {
    const review = reconciliationReview;

    if (!review || busy) return;

    setBusy(true);

    try {
      const latest = await fetchServicesForCategoryReconciliation(
        review.source,
      );

      if (latest.error || !latest.data) {
        toast({
          title: 'Could not verify current services',
          description:
            latest.error?.message ||
            'The operation was stopped. Please review again.',
          variant: 'destructive',
        });
        return;
      }

      const originalSnapshot = JSON.stringify(
        getServiceSnapshot(review.services),
      );

      const latestSnapshot = JSON.stringify(
        getServiceSnapshot(latest.data),
      );

      if (originalSnapshot !== latestSnapshot) {
        setReconciliationConfirmOpen(false);
        setReconciliationReview(null);

        toast({
          title: 'Service records have changed',
          description:
            'No changes were made. Review the updated service list before confirming again.',
          variant: 'destructive',
        });

        return;
      }

      const categories = await fetchServiceCategoriesStrict();

      if (categories.error || !categories.data) {
        toast({
          title: 'Could not verify destination category',
          description:
            categories.error?.message || 'The operation was stopped.',
          variant: 'destructive',
        });
        return;
      }

      const destination = categories.data.find(
        (category) =>
          category.id === review.target && category.is_active,
      );

      if (!destination) {
        toast({
          title: 'Destination category is no longer active',
          description:
            'Choose another active official category and review again.',
          variant: 'destructive',
        });
        setReconciliationConfirmOpen(false);
        setReconciliationReview(null);
        await load();
        return;
      }

      const { data: updatedServices, error } =
        await reassignServicesToCategory(review.source, review.target);

      if (error) {
        toast({
          title: 'Reassignment failed',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      const updatedCount = updatedServices?.length || 0;

      if (updatedCount !== review.services.length) {
        toast({
          title: 'Some services changed during reassignment',
          description: `${updatedCount} of ${review.services.length} service(s) were linked. Refresh the list and review any remaining unlinked services.`,
          variant: 'destructive',
        });
        await refreshAfterMutation();
        setReconciliationConfirmOpen(false);
        setReconciliationReview(null);
        resetReconciliation();
        return;
      }

      toast({
        title: 'Services linked successfully',
        description: `${updatedCount} service(s) linked to "${destination.name}". Legacy category text was preserved.`,
      });

      setReconciliationConfirmOpen(false);
      setReconciliationReview(null);
      resetReconciliation();
      await refreshAfterMutation();
    } catch (error) {
      toast({
        title: 'Reconciliation failed',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const updateForm = <K extends keyof CategoryForm>(
    key: K,
    value: CategoryForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (!nextOpen) {
            resetEditor();
            resetReconciliation();
            setDeleteTarget(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Layers className="mr-2 h-4 w-4" />
            Service Category
          </Button>
        </DialogTrigger>

        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg sm:p-6">
          <DialogHeader className="shrink-0 border-b px-5 py-4 sm:border-0 sm:px-0 sm:py-0">
            <div className="flex items-center gap-2">
              {editorOpen ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  disabled={busy}
                  onClick={() => {
                    if (reviewing) setReviewing(false);
                    else resetEditor();
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : null}

              <DialogTitle>
                {reviewing
                  ? 'Review category changes'
                  : editorOpen
                    ? editing
                      ? 'Edit service category'
                      : 'Create service category'
                    : 'Service Categories'}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading categories from the database…
              </div>
            ) : loadError ? (
              <div className="space-y-4 rounded-lg border border-destructive/30 p-4">
                <p className="font-medium text-destructive">
                  Categories could not be loaded.
                </p>
                <p className="break-words text-sm text-muted-foreground">
                  {loadError}
                </p>
                <p className="text-sm text-muted-foreground">
                  Cached and sample categories are intentionally not shown
                  here. Retry the database request before making changes.
                </p>
                <Button onClick={() => void load()} disabled={loading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : reviewing ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Check the proposed values before approving this change.
                </p>

                <div className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      Category name
                    </span>
                    <Badge variant={editing ? 'secondary' : 'default'}>
                      {editing ? 'Update' : 'New category'}
                    </Badge>
                  </div>

                  {editing && editing.name !== effectiveCategoryName ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground line-through">
                        {editing.name}
                      </p>
                      <p className="font-semibold">{effectiveCategoryName}</p>
                    </div>
                  ) : (
                    <p className="font-semibold">{effectiveCategoryName}</p>
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Description
                      </p>
                      <p className="text-sm">
                        {form.description.trim() || 'Not provided'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Display order
                      </p>
                      <p className="text-sm">{form.sort_order}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-sm">
                        {form.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    {editing ? (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total services
                        </p>
                        <p className="text-sm">
                          {getCategoryServiceCount(editing.id, editing.name, serviceCounts, unlinkedServiceCounts)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <img
                    src={categoryImage(effectiveCategoryName, form.image_key)}
                    alt=""
                    className="h-16 w-24 rounded-md object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium">
                      Selected marketplace fallback image
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_IMAGE_OPTIONS.find(
                        (option) => option.key === form.image_key,
                      )?.label || 'Residential Cleaning'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Services use this image unless they have their own image.
                    </p>
                  </div>
                </div>
              </div>
            ) : editorOpen ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="category-name">Category name *</Label>
                  <Input
                    id="category-name"
                    value={form.name}
                    onChange={(event) =>
                      updateForm('name', event.target.value)
                    }
                    maxLength={100}
                    placeholder="e.g. Post-Construction Cleaning"
                  />
                  {duplicateName ? (
                    <p className="text-sm text-destructive">
                      A category with this name already exists.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category-description">Description</Label>
                  <Textarea
                    id="category-description"
                    value={form.description}
                    onChange={(event) =>
                      updateForm('description', event.target.value)
                    }
                    rows={3}
                    placeholder="Optional description for this category"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category-order">Display order</Label>
                    <Input
                      id="category-order"
                      type="number"
                      min="0"
                      step="1"
                      value={form.sort_order}
                      onChange={(event) =>
                        updateForm('sort_order', event.target.value)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <Label htmlFor="category-active">Active status</Label>
                      <p className="text-xs text-muted-foreground">
                        Available for new assignments
                      </p>
                    </div>
                    <Switch
                      id="category-active"
                      checked={form.is_active}
                      onCheckedChange={(checked) =>
                        updateForm('is_active', checked)
                      }
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Category fallback image</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This image is used by services in this category unless a
                      service has its own image.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {CATEGORY_IMAGE_OPTIONS.map((option) => {
                      const selected = form.image_key === option.key;

                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              image_key: option.key,
                            }))
                          }
                          aria-pressed={selected}
                          className={`overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selected
                              ? 'border-primary ring-2 ring-primary'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <img
                            src={option.src}
                            alt={option.label}
                            className="h-24 w-full object-cover"
                          />
                          <span className="block p-2 text-xs font-medium">
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <section className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Official categories</h3>
                      <p className="text-sm text-muted-foreground">
                        Manage the categories available for service assignments.
                      </p>
                    </div>
                    <Button onClick={beginCreate}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add category
                    </Button>
                  </div>

                  {sorted.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No categories were found in the database.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {sorted.map((row) => {
                        const count = getCategoryServiceCount(
                          row.id,
                          row.name,
                          serviceCounts,
                          unlinkedServiceCounts,
                        );

                        return (
                          <div
                            key={row.id}
                            className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                          >
                            <img
                              src={categoryImage(row.name, row.image_key)}
                              alt=""
                              className="h-20 w-full rounded-md object-cover sm:h-14 sm:w-24"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">{row.name}</p>
                                <Badge
                                  variant={
                                    row.is_active ? 'default' : 'secondary'
                                  }
                                >
                                  {row.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>

                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {row.description || 'No description'}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                Order: {row.sort_order} · {count} total
                                service{count === 1 ? '' : 's'}
                              </p>
                            </div>

                            <div className="flex gap-2 sm:shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 sm:flex-none"
                                disabled={busy}
                                onClick={() => beginEdit(row)}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Button>

                              <Button
                                variant="outline"
                                size="icon"
                                aria-label={`Archive ${row.name}`}
                                disabled={busy}
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="space-y-4 border-t pt-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <h3 className="font-semibold">
                        Unregistered service categories
                      </h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      These category names appear on service records but are
                      not registered in the official catalogue. Review the
                      assigned services and reassign them to an active official category. This screen does not archive services.
                    </p>
                  </div>

                  {unregisteredCategories.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-5 text-center">
                      <p className="font-medium">
                        No unregistered categories found
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        All service category names match registered official
                        categories.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {unregisteredCategories.map((name) => (
                        <div
                          key={name}
                          className="space-y-3 rounded-lg border border-amber-500/30 p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{name.trim()}</p>
                            <Badge variant="secondary">
                              {unlinkedServiceCounts[name] || 0} unlinked service
                              {(unlinkedServiceCounts[name] || 0) === 1 ? '' : 's'}
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`reconcile-${name}`}>
                              Destination official category
                            </Label>
                            <select
                              id={`reconcile-${name}`}
                              value={
                                reconciliationSource === name
                                  ? reconciliationTarget
                                  : ''
                              }
                              disabled={busy || reconciliationLoading}
                              onChange={(event) => {
                                setReconciliationSource(name);
                                setReconciliationTarget(event.target.value);
                              }}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="">
                                Select an active official category
                              </option>
                              {activeCategories.map((category) => (
                                <option
                                  key={category.id}
                                  value={category.id}
                                >
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                              variant="outline"
                              className="flex-1"
                              disabled={
                                busy ||
                                reconciliationLoading ||
                                !reconciliationTarget ||
                                reconciliationSource !== name
                              }
                              onClick={() => {
                                setReconciliationSource(name);
                                void beginReconciliationReview(
                                  'reassign',
                                  name,
                                  reconciliationTarget,
                                );
                              }}
                            >
                              <ArrowRightLeft className="mr-2 h-4 w-4" />
                              Review reassignment
                            </Button>

                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t bg-background px-5 py-4 sm:px-0 sm:pb-0">
            {reviewing ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setReviewing(false)}
                >
                  Back to edit
                </Button>
                <Button disabled={busy} onClick={() => void save()}>
                  <Save className="mr-2 h-4 w-4" />
                  {busy ? 'Saving…' : 'Approve and save changes'}
                </Button>
              </div>
            ) : editorOpen ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={resetEditor}
                >
                  Cancel
                </Button>
                <Button
                  disabled={!validForm || busy}
                  onClick={() => setReviewing(true)}
                >
                  Review changes
                </Button>
              </div>
            ) : !loading && !loadError ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Close
                </Button>
                <Button onClick={beginCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add category
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !busy) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this category?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  You are about to archive <strong>{deleteTarget.name}</strong>.
                  There are {getCategoryServiceCount(deleteTarget.id, deleteTarget.name, serviceCounts, unlinkedServiceCounts)} total services. The category will become unavailable for new
                  assignments, but its assigned services will remain active
                  and their existing records will be preserved.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !deleteTarget}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? 'Archiving…' : 'Confirm archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={reconciliationConfirmOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !busy) {
            setReconciliationConfirmOpen(false);
            setReconciliationReview(null);
          }
        }}
      >
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm service reassignment
            </AlertDialogTitle>

            <AlertDialogDescription>
              You are about to link {reconciliationReview?.services.length || 0} service record(s) from the legacy category "{reconciliationReview?.source}" to the official category "{reconciliationReview?.targetName}". The service records and legacy category text will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {reconciliationReview ? (
            <div className="space-y-3">
              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-semibold">
                  Services included in this operation
                </p>

                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {reconciliationReview.services.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium">
                          {service.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Code: {service.service_code || '—'} ·{' '}
                          {service.is_active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm">
                        KSh {Number(service.base_price || 0).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border p-3 text-sm">
                <p>
                  <strong>From:</strong> {reconciliationReview.source}
                </p>
                <p className="mt-1">
                  <strong>To:</strong> {reconciliationReview.targetName}
                </p>
                <p className="mt-2 text-muted-foreground">
                  Existing service records and their legacy category text
                  will be retained. Only the official category link will be
                  added.
                </p>
              </div>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              Go back
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={busy || !reconciliationReview}
              onClick={(event) => {
                event.preventDefault();
                void confirmReconciliation();
              }}
            >
              {busy ? 'Processing…' : 'Confirm reassignment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
