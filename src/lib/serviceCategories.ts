import { supabase } from '@/integrations/supabase/client';

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  image_key: string;
}

export interface ReconciliationService {
  id: string;
  name: string;
  category: string;
  category_id: string | null;
  service_code: string | null;
  base_price: number;
  is_active: boolean;
}

type CategoryResult = {
  data: ServiceCategory[] | null;
  error: Error | null;
};

export async function fetchServiceCategoriesStrict(): Promise<CategoryResult> {
  const { data, error } = await supabase
    .from('service_categories')
    .select('id, name, description, sort_order, is_active, image_key')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  if (!data) {
    return {
      data: null,
      error: new Error('The category query returned no data.'),
    };
  }

  return { data: data as ServiceCategory[], error: null };
}

export async function fetchServiceCategories(
  activeOnly = false,
): Promise<CategoryResult> {
  const result = await fetchServiceCategoriesStrict();

  if (result.error || !result.data) {
    return result;
  }

  return {
    data: activeOnly
      ? result.data.filter((category) => category.is_active)
      : result.data,
    error: null,
  };
}

export async function fetchCategoryNames(
  activeOnly = false,
): Promise<string[]> {
  const result = await fetchServiceCategories(activeOnly);

  if (result.error) {
    throw result.error;
  }

  return (result.data || []).map((category) => category.name);
}

/**
 * Fetches the affected service records for administrator review.
 */
export async function fetchServicesForCategoryReconciliation(
  categoryName: string,
): Promise<{
  data: ReconciliationService[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, category, category_id, service_code, base_price, is_active')
    .is('category_id', null)
    .eq('category', categoryName)
    .order('name', { ascending: true });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return {
    data: (data || []) as ReconciliationService[],
    error: null,
  };
}

/**
 * Moves services to an existing active official category.
 * Service records are preserved.
 */
export async function reassignServicesToCategory(
  sourceCategory: string,
  targetCategoryId: string,
) {
  if (!sourceCategory.trim() || !targetCategoryId.trim()) {
    return { error: new Error('A source category and destination category ID are required.') };
  }

  return await supabase
    .from('services')
    .update({ category_id: targetCategoryId })
    .is('category_id', null)
    .eq('category', sourceCategory)
    .select('id');
}

export async function createServiceCategory(
  name: string,
  description?: string,
  sortOrder = 0,
  imageKey = 'residential',
) {
  const result = await supabase
    .from('service_categories')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      sort_order: sortOrder,
      image_key: imageKey,
    });

  return result;
}

export async function updateServiceCategory(
  id: string,
  patch: Partial<
    Pick<
      ServiceCategory,
      'name' | 'description' | 'sort_order' | 'is_active' | 'image_key'
    >
  >,
) {
  const result = await supabase
    .from('service_categories')
    .update(patch)
    .eq('id', id);

  return result;
}

/** Archives a category instead of permanently deleting its record. */
export async function archiveServiceCategory(id: string) {
  const result = await supabase
    .from('service_categories')
    .update({ is_active: false })
    .eq('id', id);

  return result;
}

export function formatServiceCode(code?: string | null): string {
  return code ? code.toUpperCase() : '—';
}

export function withServiceCode(
  name: string,
  code?: string | null,
): string {
  return code ? `${name} (${code.toUpperCase()})` : name;
}
