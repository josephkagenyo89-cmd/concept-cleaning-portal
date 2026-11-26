import { supabase } from "@/integrations/supabase/client";

import residential from '@/assets/market/residential.jpg';
import upholstery from '@/assets/market/upholstery.jpg';
import carpet from '@/assets/market/carpet.jpg';
import car from '@/assets/market/car.webp';
import commercial from '@/assets/market/commercial.jpg';
import pest from '@/assets/market/pest.jpg';
import monthlyOffers from '@/assets/market/monthly-offers.jpg';

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
