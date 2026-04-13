import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import ServiceSearch from './ServiceSearch';

export interface LineItem {
  service: any;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface MultiServiceSelectorProps {
  services: any[];
  lineItems: LineItem[];
  onChange: (items: LineItem[]) => void;
}

export default function MultiServiceSelector({ services, lineItems, onChange }: MultiServiceSelectorProps) {
  const [adding, setAdding] = useState(false);

  const addItem = (service: any) => {
    if (!service) return;
    const price = Number(service.base_price) || 0;
    onChange([...lineItems, { service, quantity: 1, unitPrice: price, total: price }]);
    setAdding(false);
  };

  const updateItem = (index: number, field: 'quantity' | 'unitPrice', value: number) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };
    item.total = item.quantity * item.unitPrice;
    updated[index] = item;
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(lineItems.filter((_, i) => i !== index));
  };

  const grandTotal = lineItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Services / Line Items</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-3.5 w-3.5 mr-1" />Add Service
        </Button>
      </div>

      {adding && (
        <Card>
          <CardContent className="p-3">
            <ServiceSearch
              services={services.filter(s => !lineItems.some(li => li.service.id === s.id))}
              selectedService={null}
              onSelect={(s) => { if (s) addItem(s); else setAdding(false); }}
            />
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setAdding(false)}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {lineItems.length > 0 && (
        <div className="space-y-2">
          {lineItems.map((item, i) => (
            <Card key={item.service.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.service.name}</p>
                    <p className="text-xs text-muted-foreground">{item.service.category}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min={1} value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', Math.max(1, Number(e.target.value) || 1))}
                      className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Unit Price</Label>
                    <Input type="number" min={Number(item.service.base_price) || 0} value={item.unitPrice}
                      onChange={e => updateItem(i, 'unitPrice', Number(e.target.value) || 0)}
                      className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Total</Label>
                    <Input value={`Ksh ${item.total.toLocaleString()}`} disabled className="h-8 text-sm bg-muted" />
                  </div>
                </div>
                {item.unitPrice < (Number(item.service.base_price) || 0) && (
                  <p className="text-xs text-destructive">Min price: Ksh {Number(item.service.base_price).toLocaleString()}</p>
                )}
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Grand Total</p>
              <p className="text-lg font-bold">Ksh {grandTotal.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
