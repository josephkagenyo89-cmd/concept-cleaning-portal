import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TierBadge from '@/components/agent/TierBadge';
import { Tier } from '@/lib/commission';
import type { DiscountType } from '@/lib/discounts';

interface LineItemDisplay {
  name: string;
  unitPrice: number;
}

interface DiscountInfo {
  subtotal: number;
  type: DiscountType;
  value: number;
  amount: number;
  status: 'not_required' | 'pending' | 'approved' | 'rejected' | string;
}

interface PriceBreakdownProps {
  serviceName: string;
  systemPrice: number;
  agentPrice: number;
  agentMargin: number;
  tier: Tier;
  commission: { commission: number; bonus: number; total: number } | null;
  quantity?: number;
  unitPrice?: number;
  /** Multi-service line items — if provided, overrides single service display */
  lineItems?: LineItemDisplay[];
  discount?: DiscountInfo;
}

export default function PriceBreakdown({
  serviceName, systemPrice, agentPrice, agentMargin, tier, commission,
  quantity = 1, unitPrice, lineItems, discount,
}: PriceBreakdownProps) {
  if (systemPrice <= 0) return null;

  const isMulti = lineItems && lineItems.length > 1;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <CardDescription className="font-medium text-foreground text-sm">Price Breakdown</CardDescription>

        {/* Multi-service line items */}
        {isMulti ? (
          <div className="space-y-1.5">
            {lineItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate mr-2">{item.name}</span>
                <span className="font-medium shrink-0">Ksh {item.unitPrice.toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t pt-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">System Price:</span>
              <span className="font-medium">Ksh {systemPrice.toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Service:</span>
            <span className="font-medium">{serviceName}</span>

            {quantity > 1 && unitPrice != null && (
              <>
                <span className="text-muted-foreground">Unit Price:</span>
                <span className="font-medium">Ksh {unitPrice.toLocaleString()}</span>
                <span className="text-muted-foreground">Quantity:</span>
                <span className="font-medium">{quantity}</span>
              </>
            )}

            <span className="text-muted-foreground">System Price:</span>
            <span className="font-medium">Ksh {systemPrice.toLocaleString()}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Your Price:</span>
          <span className="font-bold text-foreground">Ksh {agentPrice.toLocaleString()}</span>

          {agentMargin > 0 && (
            <>
              <span className="text-muted-foreground">Agent Margin:</span>
              <span className="font-medium text-primary">+Ksh {agentMargin.toLocaleString()}</span>
            </>
          )}
        </div>

        {commission && (
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
        )}
      </CardContent>
    </Card>
  );
}
