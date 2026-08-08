import { AllSettings, DiscountSettings } from '@/lib/settings';

export interface GlobalDiscountState {
  active: boolean;
  percentage: number;
  label: string;
  startDate: string;
  endDate: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Resolves the ERP-controlled global discount. Base service prices are never
 * modified — this is applied dynamically at display/calculation time only.
 */
export function getGlobalDiscount(d?: DiscountSettings | null): GlobalDiscountState {
  const pct = Math.min(100, Math.max(0, Number(d?.global_percentage) || 0));
  const start = (d?.start_date || '').trim();
  const end = (d?.end_date || '').trim();
  const today = todayIso();
  const withinStart = !start || start <= today;
  const withinEnd = !end || end >= today;
  return {
    active: !!d?.global_enabled && pct > 0 && withinStart && withinEnd,
    percentage: pct,
    label: (d?.label || '').trim() || `${pct}% off all services`,
    startDate: start,
    endDate: end,
  };
}

export function globalDiscountFromSettings(s: AllSettings): GlobalDiscountState {
  return getGlobalDiscount(s.discount);
}

export interface PriceBreakdown {
  original: number;
  percentage: number;
  discountAmount: number;
  final: number;
  active: boolean;
}

/** Applies the active global discount to a base price. */
export function applyGlobalDiscount(basePrice: number, state: GlobalDiscountState): PriceBreakdown {
  const original = Math.max(0, Number(basePrice) || 0);
  if (!state.active || original <= 0) {
    return { original, percentage: 0, discountAmount: 0, final: original, active: false };
  }
  const discountAmount = Math.round(((original * state.percentage) / 100) * 100) / 100;
  return {
    original,
    percentage: state.percentage,
    discountAmount,
    final: Math.max(0, original - discountAmount),
    active: true,
  };
}
