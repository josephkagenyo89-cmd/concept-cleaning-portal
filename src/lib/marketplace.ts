import { supabase } from "@/integrations/supabase/client";

import residential from '@/assets/market/residential.jpg';
import upholstery from '@/assets/market/upholstery.jpg';
import carpet from '@/assets/market/carpet.jpg';
import car from '@/assets/market/car.webp';
import commercial from '@/assets/market/commercial.jpg';
import pest from '@/assets/market/pest.jpg';
import monthlyOffers from '@/assets/market/monthly-offers.jpg';

export interface MarketService {
  id: string;
  name: string;
  slug: string | null;
  service_code: string | null;
  description: string | null;
  short_description: string | null;
  category: string;
  base_price: number;
  price_per_sqm: number;
  pricing_model: string;
  pricing_unit: string;
  is_active: boolean;
  image_url: string | null;
  estimated_duration: string | null;
  service_features: string[];
}

/** Images available for category-level fallback imagery. */
export const CATEGORY_IMAGE_OPTIONS = [
  { key: 'residential', label: 'Residential Cleaning', src: residential },
  { key: 'upholstery', label: 'Upholstery Cleaning', src: upholstery },
  { key: 'carpet', label: 'Carpet & Rug Cleaning', src: carpet },
  { key: 'car', label: 'Car Interior Cleaning', src: car },
  { key: 'commercial', label: 'Commercial Cleaning', src: commercial },
  { key: 'pest', label: 'Fumigation & Pest Control', src: pest },
  { key: 'monthly-offers', label: 'Monthly Offers', src: monthlyOffers },
] as const;

const CATEGORY_IMAGE_BY_KEY: Record<string, string> = Object.fromEntries(
  CATEGORY_IMAGE_OPTIONS.map((option) => [option.key, option.src]),
);

const CATEGORY_IMAGES: Record<string, string> = {
  'Residential Cleaning': residential,
  'General Cleaning': residential,
  'Cleaning Services': residential,
  'Deep Cleaning': residential,
  'Upholstery Cleaning': upholstery,
  'SOFA / Upholstery Cleaning': upholstery,
  'Upholstery & Carpet Cleaning': upholstery,
  'Carpet & Rug Cleaning': carpet,
  'Car Interior Cleaning': car,
  'Commercial Cleaning': commercial,
  'Fumigation': pest,
  'Fumigation & Pest Control': pest,
  'Monthly offer': monthlyOffers,
};

let categoryImageMap: Record<string, string> = {};
let categoryImageMapLoaded = false;
let categoryImageMapRequest: Promise<void> | null = null;

function normalizeCategoryName(value: string): string {
  return value.trim().toLocaleLowerCase('en');
}

/** Load the authoritative category-to-image mapping from the database. */
async function loadCategoryImageMap(): Promise<void> {
  if (categoryImageMapLoaded) return;

  if (categoryImageMapRequest) {
    return categoryImageMapRequest;
  }

  categoryImageMapRequest = (async () => {
    const { data, error } = await supabase
      .from('service_categories')
      .select('name, image_key');

    if (error) {
      console.warn('Could not load category image mappings:', error.message);
      return;
    }

    const nextMap: Record<string, string> = {};

    for (const row of data || []) {
      const name = normalizeCategoryName(row.name || '');
      const key = String(row.image_key || '').trim().toLowerCase();
      const image = CATEGORY_IMAGE_BY_KEY[key];

      if (name && image) {
        nextMap[name] = image;
      }
    }

    categoryImageMap = nextMap;
    categoryImageMapLoaded = true;
  })();

  try {
    await categoryImageMapRequest;
  } finally {
    categoryImageMapRequest = null;
  }
}

export function invalidateCategoryImageMap(): void {
  categoryImageMap = {};
  categoryImageMapLoaded = false;
  categoryImageMapRequest = null;
}

export const CATEGORY_ORDER = [
  'Residential Cleaning',
  'Upholstery Cleaning',
  'Carpet & Rug Cleaning',
  'Car Interior Cleaning',
  'Commercial Cleaning',
  'Fumigation & Pest Control',
];

export function categoryImage(
  category: string,
  imageKey?: string | null,
): string {
  const key = imageKey?.trim().toLowerCase();

  if (key && CATEGORY_IMAGE_BY_KEY[key]) {
    return CATEGORY_IMAGE_BY_KEY[key];
  }

  const normalizedName = normalizeCategoryName(category);

  if (categoryImageMap[normalizedName]) {
    return categoryImageMap[normalizedName];
  }

  const legacyMatch = Object.entries(CATEGORY_IMAGES).find(
    ([name]) => normalizeCategoryName(name) === normalizedName,
  );

  return legacyMatch?.[1] || residential;
}

export function serviceImage(
  service: Pick<MarketService, 'image_url' | 'category'>
): string {
  return service.image_url || categoryImage(service.category);
}

export function formatKes(amount: number): string {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', {
    maximumFractionDigits: 0,
  })}`;
}

/** Services module is the single source of truth for the marketplace catalogue. */
export async function fetchMarketServices(): Promise<MarketService[]> {
  await loadCategoryImageMap();
  const { data, error } = await supabase
    .from('services')
    .select('id, name, slug, service_code, description, short_description, category, base_price, price_per_sqm, pricing_model, pricing_unit, is_active, image_url, estimated_duration, service_features')
    .eq('is_active', true)
    .order('category')
    .order('name');

  if (error) throw error;

  return ((data || []) as any[]).map((s) => ({
    ...s,
    slug: s.slug || null,
    base_price: Number(s.base_price) || 0,
    price_per_sqm: Number(s.price_per_sqm) || 0,
    service_features: Array.isArray(s.service_features)
      ? s.service_features
      : [],
  })) as MarketService[];
}

/** Optimized for landing page: fetch only N services instead of all 191. Reduces Supabase query load by ~97%. */
export async function fetchMarketServicesLimited(limit: number = 6): Promise<MarketService[]> {
  await loadCategoryImageMap();
  const { data, error } = await supabase
    .from('services')
    .select('id, name, slug, service_code, description, short_description, category, base_price, price_per_sqm, pricing_model, pricing_unit, is_active, image_url, estimated_duration, service_features')
    .eq('is_active', true)
    .order('category')
    .order('name')
    .limit(limit);

  if (error) throw error;

  return ((data || []) as any[]).map((s) => ({
    ...s,
    slug: s.slug || null,
    base_price: Number(s.base_price) || 0,
    price_per_sqm: Number(s.price_per_sqm) || 0,
    service_features: Array.isArray(s.service_features)
      ? s.service_features
      : [],
  })) as MarketService[];
}

export function groupByCategory(
  services: MarketService[]
): [string, MarketService[]][] {
  const groups: Record<string, MarketService[]> = {};

  services.forEach((s) => {
    (groups[s.category] = groups[s.category] || []).push(s);
  });

  const sorted: [string, MarketService[]][] = [];

  CATEGORY_ORDER.forEach((c) => {
    if (groups[c]) sorted.push([c, groups[c]]);
  });

  Object.keys(groups).forEach((c) => {
    if (!CATEGORY_ORDER.includes(c)) sorted.push([c, groups[c]]);
  });

  return sorted;
}

/** Lightweight landing-page query: fetch category names only, not full service records. */
export async function fetchMarketCategories(): Promise<string[]> {
  await loadCategoryImageMap();
  const { data, error } = await supabase
    .from('services')
    .select('category')
    .eq('is_active', true)
    .not('category', 'is', null)
    .order('category')
    .limit(191);

  if (error) throw error;
  return Array.from(new Set((data || []).map((row: any) => String(row.category || '').trim()).filter(Boolean)));
}


/** Booking Engine category chips: derive categories from active services directly. */
export async function fetchBookingEngineCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('services')
    .select('category')
    .eq('is_active', true)
    .not('category', 'is', null)
    .order('category');

  if (error) throw error;

  return Array.from(
    new Set(
      (data || [])
        .map((row: any) => String(row.category || '').trim())
        .filter(Boolean)
    )
  );
}

/** Booking Engine catalogue: fetch active services directly from the services table. */
export async function fetchBookingEngineServices(): Promise<MarketService[]> {
  await loadCategoryImageMap();

  const { data, error } = await supabase
    .from('services')
    .select(`
      id,
      name,
      slug,
      service_code,
      description,
      short_description,
      category,
      base_price,
      price_per_sqm,
      pricing_model,
      pricing_unit,
      is_active,
      image_url,
      estimated_duration,
      service_features
    `)
    .eq('is_active', true)
    .not('category', 'is', null)
    .order('category')
    .order('name');

  if (error) throw error;

  return (data || []).map((service: any) => ({
    ...service,
    category: String(service.category || '').trim(),
    slug: service.slug || null,
    base_price: Number(service.base_price) || 0,
    price_per_sqm: Number(service.price_per_sqm) || 0,
    service_features: Array.isArray(service.service_features)
      ? service.service_features
      : [],
  })) as MarketService[];
}

export function startingPrice(s: MarketService): number {
  return s.base_price > 0 ? s.base_price : s.price_per_sqm;
}

/* ------------------------------------------------------------------ *
 * Intelligent cross-sell recommendations
 * ------------------------------------------------------------------ */

/** Category → categories that pair well with it (cross-selling). */
const CROSS_SELL: Record<string, string[]> = {
  'Fumigation & Pest Control': [
    'Upholstery Cleaning',
    'Residential Cleaning',
  ],
  'Upholstery Cleaning': [
    'Carpet & Rug Cleaning',
    'Residential Cleaning',
  ],
  'Carpet & Rug Cleaning': [
    'Upholstery Cleaning',
    'Residential Cleaning',
  ],
  'Commercial Cleaning': [
    'Carpet & Rug Cleaning',
    'Residential Cleaning',
  ],
  'Residential Cleaning': [
    'Fumigation & Pest Control',
    'Upholstery Cleaning',
  ],
  'Car Interior Cleaning': [
    'Upholstery Cleaning',
    'Carpet & Rug Cleaning',
  ],
};

/** Keyword fallback so cross-selling still works for custom categories. */
const KEYWORD_CROSS_SELL: [RegExp, string[]][] = [
  [/fumigat|pest/i, ['sofa', 'upholster', 'deep']],
  [/sofa|upholster/i, ['carpet', 'mattress']],
  [/office|commercial/i, ['window', 'carpet']],
  [/deep|residential|house/i, ['pest', 'fumigat']],
  [/car|vehicle/i, ['upholster', 'carpet']],
];

function matchesKeywords(s: MarketService, keywords: string[]) {
  const hay = `${s.name} ${s.category}`.toLowerCase();

  return keywords.some((k) =>
    hay.includes(k.toLowerCase())
  );
}

/** A featured category that rotates daily, used when there is no history. */
export function rotatingFeaturedCategory(
  available: string[]
): string | null {
  const list = available.length ? available : CATEGORY_ORDER;

  if (!list.length) return null;

  const dayIndex = Math.floor(Date.now() / 86_400_000);

  return list[dayIndex % list.length];
}

export interface Recommendation {
  reason: string;
  services: MarketService[];
}

/**
 * Cross-sell based on the categories/names of services the customer has
 * already booked. Falls back to a rotating featured category.
 */
export function buildRecommendations(
  services: MarketService[],
  historyCategories: string[],
  historyNames: string[] = []
): Recommendation {
  const available = Array.from(
    new Set(services.map((s) => s.category))
  );

  if (historyCategories.length || historyNames.length) {
    const wanted = new Set<string>();

    historyCategories.forEach((c) =>
      (CROSS_SELL[c] || []).forEach((x) => wanted.add(x))
    );

    const keywordTargets: string[] = [];

    [...historyCategories, ...historyNames].forEach((label) => {
      KEYWORD_CROSS_SELL.forEach(([re, targets]) => {
        if (re.test(label)) keywordTargets.push(...targets);
      });
    });

    const booked = new Set(historyCategories);

    const picks = services.filter(
      (s) =>
        !booked.has(s.category) &&
        (wanted.has(s.category) ||
          matchesKeywords(s, keywordTargets))
    );

    if (picks.length) {
      return {
        reason: 'Goes well with what you have booked before',
        services: picks.slice(0, 8),
      };
    }
  }

  const featured = rotatingFeaturedCategory(available);

  const list = featured
    ? services.filter((s) => s.category === featured)
    : [];

  return {
    reason: featured
      ? `Featured today: ${featured}`
      : 'Popular services',
    services: (list.length ? list : services).slice(0, 8),
  };
}

/** Fetch only active services belonging to the selected category. */
export async function fetchMarketServicesByCategory(
  category: string
): Promise<MarketService[]> {
  const normalizedCategory = category.trim();
  if (!normalizedCategory) return [];

  await loadCategoryImageMap();
  const { data, error } = await supabase
    .from('services')
    .select('id, name, slug, service_code, description, short_description, category, base_price, price_per_sqm, pricing_model, pricing_unit, is_active, image_url, estimated_duration, service_features')
    .eq('is_active', true)
    .ilike('category', `${normalizedCategory}%`)
    .order('name');

  if (error) throw error;

  const matchingServices = ((data || []) as any[]).filter(
    (service) =>
      typeof service.category === 'string' &&
      service.category.trim() === normalizedCategory
  );

  return matchingServices.map((s) => ({
    ...s,
    slug: s.slug || null,
    base_price: Number(s.base_price) || 0,
    price_per_sqm: Number(s.price_per_sqm) || 0,
    service_features: Array.isArray(s.service_features)
      ? s.service_features
      : [],
  })) as MarketService[];
}
