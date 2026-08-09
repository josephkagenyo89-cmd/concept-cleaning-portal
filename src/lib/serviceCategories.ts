import { supabase } from '@/integrations/supabase/client';

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

/** Fallback list used only when the categories table cannot be reached (offline). */
export const FALLBACK_CATEGORIES = [
  'Residential Cleaning',
  'Upholstery Cleaning',
  'Carpet & Rug Cleaning',
  'Car Interior Cleaning',
  'Commercial Cleaning',
  'Fumigation & Pest Control',
];

const CACHE_KEY = 'ccs_service_categories';

/** Service categories are managed in ERP → Services → Categories. */
export async function fetchServiceCategories(activeOnly = false): Promise<ServiceCategory[]> {
  const query = supabase
    .from('service_categories' as any)
    .select('*')
    .order('sort_order')
    .order('name');
  const { data, error } = activeOnly ? await query.eq('is_active', true) : await query;
  if (error || !data) {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached) as ServiceCategory[];
    } catch { /* ignore */ }
    return FALLBACK_CATEGORIES.map((name, i) => ({
      id: name, name, description: null, sort_order: i + 1, is_active: true,
    }));
  }
  const list = data as unknown as ServiceCategory[];
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}

export async function fetchCategoryNames(activeOnly = false): Promise<string[]> {
  return (await fetchServiceCategories(activeOnly)).map((c) => c.name);
}

export async function createServiceCategory(name: string, description?: string, sortOrder = 0) {
  return await supabase
    .from('service_categories' as any)
    .insert({ name: name.trim(), description: description || null, sort_order: sortOrder } as any);
}

export async function updateServiceCategory(id: string, patch: Partial<ServiceCategory>) {
  return await supabase.from('service_categories' as any).update(patch as any).eq('id', id);
}

export async function deleteServiceCategory(id: string) {
  return await supabase.from('service_categories' as any).delete().eq('id', id);
}

/** Formats a service code for display, e.g. "SC3S". */
export function formatServiceCode(code?: string | null): string {
  return code ? code.toUpperCase() : '—';
}

/** Appends the service code to a service name for documents: "Sofa Cleaning (SC)". */
export function withServiceCode(name: string, code?: string | null): string {
  return code ? `${name} (${code.toUpperCase()})` : name;
}
