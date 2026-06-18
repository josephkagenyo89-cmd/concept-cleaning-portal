export type DiscountType = 'percent' | 'fixed' | null | '';

export interface DiscountInput {
  type: DiscountType;
  value: number;
  reason?: string;
}

export interface DiscountResult {
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
}

export function computeDiscount(subtotal: number, type: DiscountType, value: number): DiscountResult {
  const sub = Math.max(0, Number(subtotal) || 0);
  const v = Math.max(0, Number(value) || 0);
  let amount = 0;
  if (type === 'percent') amount = (sub * Math.min(v, 100)) / 100;
  else if (type === 'fixed') amount = Math.min(v, sub);
  amount = Math.round(amount * 100) / 100;
  return { subtotal: sub, discountAmount: amount, finalTotal: Math.max(0, sub - amount) };
}

export function formatDiscountLabel(type: DiscountType, value: number): string {
  if (!type || !value) return '';
  return type === 'percent' ? `${value}% off` : `Ksh ${Number(value).toLocaleString()} off`;
}

export function needsApproval(role: string): boolean {
  return role === 'agent';
}
