import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DynamicServiceInputProps {
  inputType: string;
  dropdownOptions: string[];
  pricingUnit: string;
  value: string;
  onChange: (value: string) => void;
}

const UNIT_LABELS: Record<string, string> = {
  per_sqft: 'Size (Square Feet)',
  per_sqm: 'Size (Square Meters)',
  per_unit: 'Quantity',
  unit: 'Quantity',
  fixed: 'Variation',
};

export default function DynamicServiceInput({ inputType, dropdownOptions, pricingUnit, value, onChange }: DynamicServiceInputProps) {
  const label = UNIT_LABELS[pricingUnit] || 'Quantity';

  if (inputType === 'dropdown' && dropdownOptions.length > 0) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {dropdownOptions.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Enter ${label.toLowerCase()}`}
        min={1}
        required
      />
    </div>
  );
}
