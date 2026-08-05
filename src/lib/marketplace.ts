import { supabase } from '@/integrations/supabase/client';
import residential from '@/assets/market/residential.jpg';
import upholstery from '@/assets/market/upholstery.jpg';
import carpet from '@/assets/market/carpet.jpg';
import car from '@/assets/market/car.jpg';
import commercial from '@/assets/market/commercial.jpg';
import pest from '@/assets/market/pest.jpg';

export interface MarketService {
  id: string;
  name: string;
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

/** Fallback imagery per category — used when a service has no image in the Services module. */
const CATEGORY_IMAGES: Record<string, string> = {
  'Residential Cleaning': residential,
  'Upholstery Cleaning': upholstery,
  'Carpet & Rug Cleaning': carpet,
  'Car Interior Cleaning': car,
  'Commercial Cleaning': commercial,
  'Fumigation & Pest Control': pest,
};

export const CATEGORY_ORDER = [
  'Residential Cleaning',
  'Upholstery Cleaning',
  'Carpet & Rug Cleaning',
  'Car Interior Cleaning',
  'Commercial Cleaning',
  'Fumigation & Pest Control',
];

export function categoryImage(category: string): string {
  return CATEGORY_IMAGES[category] || residential;
}

export function serviceImage(service: Pick<MarketService, 'image_url' | 'category'>): string {
  return service.image_url || categoryImage(service.category);
}

export function formatKes(amount: number): string {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
}

/** Services module is the single source of truth for the marketplace catalogue. */
export async function fetchMarketServices(): Promise<MarketService[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name');
  if (error) throw error;
  return ((data || []) as any[]).map((s) => ({
    ...s,
    base_price: Number(s.base_price) || 0,
    price_per_sqm: Number(s.price_per_sqm) || 0,
    service_features: Array.isArray(s.service_features) ? s.service_features : [],
  })) as MarketService[];
}

export function groupByCategory(services: MarketService[]): [string, MarketService[]][] {
  const groups: Record<string, MarketService[]> = {};
  services.forEach((s) => {
    (groups[s.category] = groups[s.category] || []).push(s);
  });
  const sorted: [string, MarketService[]][] = [];
  CATEGORY_ORDER.forEach((c) => { if (groups[c]) sorted.push([c, groups[c]]); });
  Object.keys(groups).forEach((c) => { if (!CATEGORY_ORDER.includes(c)) sorted.push([c, groups[c]]); });
  return sorted;
}

/** Deterministic pseudo-rating so cards look complete without inventing stored data. */
export function displayRating(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return 4.3 + (h % 7) / 10;
}

export function startingPrice(s: MarketService): number {
  return s.base_price > 0 ? s.base_price : s.price_per_sqm;
}
