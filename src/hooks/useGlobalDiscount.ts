import { useSettings } from '@/hooks/useSettings';
import { getGlobalDiscount, GlobalDiscountState } from '@/lib/globalDiscount';

/** Reads the ERP-controlled global discount from system settings. */
export function useGlobalDiscount(): GlobalDiscountState {
  const { settings } = useSettings();
  return getGlobalDiscount(settings.discount);
}
