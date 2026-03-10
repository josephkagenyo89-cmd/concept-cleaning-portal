import { Card, CardContent, CardDescription } from '@/components/ui/card';
import TierBadge from '@/components/agent/TierBadge';
import { Tier } from '@/lib/commission';

interface PriceBreakdownProps {
  serviceName: string;
  quantity: string;
  systemPrice: number;
  agentPrice: number;
  agentMargin: number;
  tier: Tier;
  commission: { commission: number; bonus: number; total: number } | null;
}

export default function PriceBreakdown({ serviceName, quantity, systemPrice, agentPrice, agentMargin, tier, commission }: PriceBreakdownProps) {
  if (systemPrice <= 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <CardDescription className="font-medium text-foreground text-sm">Price Breakdown</CardDescription>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Service:</span>
          <span className="font-medium">{serviceName}</span>

          <span className="text-muted-foreground">Quantity/Selection:</span>
          <span className="font-medium">{quantity}</span>

          <span className="text-muted-foreground">System Price:</span>
          <span className="font-medium">Ksh {systemPrice.toLocaleString()}</span>

          <span className="text-muted-foreground">Agent Price:</span>
          <span className="font-bold text-foreground">Ksh {agentPrice.toLocaleString()}</span>

          {agentMargin > 0 && (
            <>
              <span className="text-muted-foreground">Agent Margin:</span>
              <span className="font-medium text-primary">+Ksh {agentMargin.toLocaleString()}</span>
            </>
          )}
        </div>

        {commission && (
          <>
            <div className="border-t pt-2 mt-2">
              <CardDescription className="font-medium text-foreground text-sm mb-2">Commission Preview</CardDescription>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">Your tier:</span>
                <TierBadge tier={tier} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Commission ({(commission.commission / agentPrice * 100).toFixed(1)}%):</span>
                <span className="font-medium">Ksh {commission.commission.toLocaleString()}</span>
                {commission.bonus > 0 && (
                  <>
                    <span className="text-muted-foreground">High-value bonus:</span>
                    <span className="font-medium text-primary">+Ksh {commission.bonus.toLocaleString()}</span>
                  </>
                )}
                <span className="text-muted-foreground font-medium">Total commission:</span>
                <span className="font-bold text-primary">Ksh {commission.total.toLocaleString()}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
