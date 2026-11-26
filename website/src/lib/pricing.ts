export interface ServiceLine {
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface PricingInput {
  services: ServiceLine[];
  transport?: number;
  membershipDiscountPct?: number;
  promoDiscountPct?: number;
  bundleDiscountPct?: number;
}

export interface PricingResult {
  subtotal: number;
  membershipDiscount: number;
  promoDiscount: number;
  bundleDiscount: number;
  transport: number;
  total: number;
  estimatedDurationMinutes: number;
}

export const calculatePricing = (input: PricingInput): PricingResult => {
  const subtotal = input.services.reduce(
    (sum, s) => sum + s.quantity * s.unitPrice,
    0,
  );
  const membershipDiscount = Math.round(
    subtotal * ((input.membershipDiscountPct ?? 0) / 100),
  );
  const promoDiscount = Math.round(
    subtotal * ((input.promoDiscountPct ?? 0) / 100),
  );
  const bundleDiscount = Math.round(
    subtotal * ((input.bundleDiscountPct ?? 0) / 100),
  );
  const transport = input.transport ?? 0;
  const total = Math.max(
    0,
    subtotal - membershipDiscount - promoDiscount - bundleDiscount + transport,
  );
  // Rough estimation: 45min per service line item
  const estimatedDurationMinutes = input.services.reduce(
    (sum, s) => sum + s.quantity * 45,
    0,
  );
  return {
    subtotal,
    membershipDiscount,
    promoDiscount,
    bundleDiscount,
    transport,
    total,
    estimatedDurationMinutes,
  };
};

export const tierDiscountPct = (tier?: string | null): number => {
  switch ((tier ?? "").toLowerCase()) {
    case "platinum":
      return 15;
    case "gold":
      return 10;
    case "silver":
      return 5;
    default:
      return 0;
  }
};

export const formatKES = (n: number) => `KES ${Math.round(n).toLocaleString()}`;
