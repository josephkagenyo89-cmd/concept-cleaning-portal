import { Gift } from "lucide-react";
import { getRewardTier } from "@/lib/rewards";

const RewardBadge = ({ amount }: { amount: number }) => {
  const tier = getRewardTier(amount);
  if (!tier) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-accent/60 border border-primary/20 text-xs">
      <Gift className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold text-primary mb-1">🎁 {tier.label} Reward</p>
        <ul className="space-y-0.5 text-muted-foreground">
          {tier.items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default RewardBadge;
