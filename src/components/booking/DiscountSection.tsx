import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { computeDiscount, DiscountType } from '@/lib/discounts';

const REASON_PRESETS = [
  'Loyal Customer',
  'Repeat Business',
  'Promotional Offer',
  'Service Recovery',
  'Corporate Agreement',
  'Management Approval',
];

export interface DiscountState {
  type: DiscountType;
  value: number;
  reason: string;
}

interface Props {
  subtotal: number;
  value: DiscountState;
  onChange: (next: DiscountState) => void;
}

export default function DiscountSection({ subtotal, value, onChange }: Props) {
  const { discountAmount, finalTotal } = computeDiscount(subtotal, value.type, value.value);
  const hasDiscount = !!value.type && value.value > 0;
  const requiresReason = hasDiscount && !value.reason.trim();

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Discount (optional)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={value.type || 'none'}
              onValueChange={(v) => onChange({ ...value, type: v === 'none' ? '' : (v as DiscountType), value: v === 'none' ? 0 : value.value })}
            >
              <SelectTrigger><SelectValue placeholder="No discount" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No discount</SelectItem>
                <SelectItem value="percent">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed Amount (Ksh)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Value</Label>
            <Input
              type="number"
              min={0}
              max={value.type === 'percent' ? 100 : subtotal || undefined}
              disabled={!value.type}
              value={value.value || ''}
              onChange={(e) => onChange({ ...value, value: Number(e.target.value) || 0 })}
              placeholder={value.type === 'percent' ? '0–100' : '0'}
            />
          </div>
        </div>

        {hasDiscount && (
          <div className="space-y-1.5">
            <Label>Reason <span className="text-destructive">*</span></Label>
            <Select
              value={value.reason && REASON_PRESETS.includes(value.reason) ? value.reason : (value.reason ? '__custom' : '')}
              onValueChange={(v) => onChange({ ...value, reason: v === '__custom' ? value.reason || '' : v })}
            >
              <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
              <SelectContent>
                {REASON_PRESETS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                <SelectItem value="__custom">Other (type below)…</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              rows={2}
              value={value.reason}
              onChange={(e) => onChange({ ...value, reason: e.target.value })}
              placeholder="Discount reason (required)"
              required
            />
            {requiresReason && <p className="text-xs text-destructive">A reason is required for any discount.</p>}
          </div>
        )}

        <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
          <div className="flex justify-between"><span>Services Total</span><span>Ksh {subtotal.toLocaleString()}</span></div>
          <div className="flex justify-between text-destructive">
            <span>Discount</span><span>− Ksh {discountAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold pt-1 border-t">
            <span>Final Total</span><span>Ksh {finalTotal.toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
