export interface RewardTier {
  minAmount: number;
  label: string;
  items: string[];
}

export const REWARD_TIERS: RewardTier[] = [
  {
    minAmount: 15000,
    label: "Gold",
    items: ["5L Multi-purpose detergent", "2L Toilet cleaner", "5L Stain remover"],
  },
  {
    minAmount: 10000,
    label: "Silver",
    items: ["5L Multi-purpose detergent", "2L Toilet cleaner"],
  },
  {
    minAmount: 7000,
    label: "Bronze",
    items: ["5L Multi-purpose detergent"],
  },
];

export const getRewardTier = (amount: number): RewardTier | null => {
  for (const tier of REWARD_TIERS) {
    if (amount >= tier.minAmount) return tier;
  }
  return null;
};

export const rewardWhatsappMessage = (name: string, items: string[]) =>
  `Thank you for choosing Concept Cleaning Services 🎉\n\nYou have received the following FREE cleaning products:\n\n${items.map((i) => `✅ ${i}`).join("\n")}\n\nWe appreciate your support!`;
