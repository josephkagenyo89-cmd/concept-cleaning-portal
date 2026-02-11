import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tier } from '@/lib/commission';

const tierColors: Record<Tier, string> = {
  bronze: 'bg-tier-bronze text-white',
  silver: 'bg-tier-silver text-white',
  gold: 'bg-tier-gold text-white',
};

export default function TierBadge({ tier }: { tier: Tier }) {
  return (
    <Badge className={cn('capitalize', tierColors[tier])}>
      {tier}
    </Badge>
  );
}
