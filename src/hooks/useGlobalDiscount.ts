import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_SETTINGS, DiscountSettings } from '@/lib/settings';
import { getGlobalDiscount, GlobalDiscountState } from '@/lib/globalDiscount';

let cachedDiscount: DiscountSettings | null = null;
let discountRequest: Promise<DiscountSettings> | null = null;
const listeners = new Set<(settings: DiscountSettings) => void>();

function loadDiscountOnce(): Promise<DiscountSettings> {
  if (cachedDiscount) return Promise.resolve(cachedDiscount);
  if (discountRequest) return discountRequest;

  discountRequest = (async () => {
    const { data, error } = await supabase
      .from('system_settings' as any)
      .select('value')
      .eq('category', 'discount')
      .maybeSingle();

    if (error || !data?.value) return DEFAULT_SETTINGS.discount;
    return { ...DEFAULT_SETTINGS.discount, ...(data.value as Partial<DiscountSettings>) };
  })().then((settings) => {
    cachedDiscount = settings;
    listeners.forEach((listener) => listener(settings));
    return settings;
  }).catch(() => DEFAULT_SETTINGS.discount).finally(() => {
    discountRequest = null;
  });

  return discountRequest;
}

/**
 * Shares one public discount request between the banner and all service cards.
 * This prevents one identical Supabase request per card.
 */
export function useGlobalDiscount(): GlobalDiscountState {
  const [discount, setDiscount] = useState<DiscountSettings>(() => cachedDiscount || DEFAULT_SETTINGS.discount);

  useEffect(() => {
    const update = (settings: DiscountSettings) => setDiscount(settings);
    listeners.add(update);
    void loadDiscountOnce().then(update);
    return () => { listeners.delete(update); };
  }, []);

  return getGlobalDiscount(discount);
}
