export type Tier = 'bronze' | 'silver' | 'gold';

export const TIER_THRESHOLDS = {
  bronze: { min: 0, max: 49999, rate: 0.05 },
  silver: { min: 50000, max: 99999, rate: 0.075 },
  gold: { min: 100000, max: Infinity, rate: 0.10 },
} as const;

export const HIGH_VALUE_THRESHOLD = 20000;
export const HIGH_VALUE_BONUS = 1000;

export function getTier(cumulativeRevenue: number): Tier {
  if (cumulativeRevenue >= 100000) return 'gold';
  if (cumulativeRevenue >= 50000) return 'silver';
  return 'bronze';
}

export function getTierRate(tier: Tier): number {
  return TIER_THRESHOLDS[tier].rate;
}

export function calculateCommission(price: number, tier: Tier) {
  const rate = getTierRate(tier);
  const commission = price * rate;
  const bonus = price >= HIGH_VALUE_THRESHOLD ? HIGH_VALUE_BONUS : 0;
  return { commission, bonus, total: commission + bonus };
}

export function getTierProgress(cumulativeRevenue: number): { tier: Tier; progress: number; nextThreshold: number } {
  const tier = getTier(cumulativeRevenue);
  if (tier === 'gold') return { tier, progress: 100, nextThreshold: 100000 };
  const threshold = tier === 'bronze' ? 50000 : 100000;
  const base = tier === 'bronze' ? 0 : 50000;
  const progress = Math.min(((cumulativeRevenue - base) / (threshold - base)) * 100, 100);
  return { tier, progress, nextThreshold: threshold };
}
