import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_SETTINGS, DiscountSettings } from '@/lib/settings';
import { getGlobalDiscount, GlobalDiscountState } from '@/lib/globalDiscount';

/** Loads only the ERP-controlled discount row, not all system settings. */
export function useGlobalDiscount(): GlobalDiscountState {
  const [discount, setDiscount] = useState<DiscountSettings>(DEFAULT_SETTINGS.discount);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('value')
        .eq('category', 'discount')
        .maybeSingle();

      if (!mounted || error || !data?.value) return;
      setDiscount({ ...DEFAULT_SETTINGS.discount, ...(data.value as Partial<DiscountSettings>) });
    };

    void load();
    return () => { mounted = false; };
  }, []);

  return getGlobalDiscount(discount);
}
