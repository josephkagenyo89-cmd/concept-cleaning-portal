import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getGlobalDiscount, type GlobalDiscountState } from '@/lib/globalDiscount';

const INACTIVE: GlobalDiscountState = {
  active: false,
  percentage: 0,
  label: '',
  startDate: '',
  endDate: '',
};

/**
 * Reads only the explicitly public discount setting. The database RLS policy
 * permits anon/authenticated reads of the discount category; no ERP settings
 * or service pricing records are loaded by this hook.
 */
export function usePublicDiscount() {
  const [discount, setDiscount] = useState<GlobalDiscountState>(INACTIVE);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('value')
        .eq('category', 'discount')
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        // Fail closed: never show a promotion when its current state is unknown.
        setDiscount(INACTIVE);
        return;
      }

      setDiscount(getGlobalDiscount((data?.value || null) as any));
    };

    void load();
    const refresh = window.setInterval(() => { void load(); }, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(refresh);
    };
  }, []);

  return { discount };
}
