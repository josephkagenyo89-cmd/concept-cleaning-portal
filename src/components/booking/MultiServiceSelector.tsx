import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const [adding, setAdding] = useState(lineItems.length === 0);

  const addItem = (service: any) => {
    if (!service) return;
    const price = Number(service.base_price) || 0;
    // Quantity is always 1 since variants already encode dimensions (e.g. "3 Seater", "2 Bedroom")
    onChange([...lineItems, { service, quantity: 1, unitPrice: price, total: price }]);
    setAdding(false);
  };

  const removeItem = (index: number) => {
    const updated = lineItems.filter((_, i) => i !== index);
    onChange(updated);
    if (updated.length === 0) setAdding(true);
  };

  const grandTotal = lineItems.reduce((sum, item) => sum + item.total, 0);

  // Services already selected (exclude from search)
  const availableServices = services.filter(s => !lineItems.some(li => li.service.id === s.id));

  return (
    <div className="space-y-3">
      {/* Selected services list */}
      {lineItems.length > 0 && (
        <div className="space-y-2">
          {lineItems.map((item, i) => (
            <div key={item.service.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.service.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{item.service.category}</span>
                  {item.unitPrice > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Ksh {item.unitPrice.toLocaleString()}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive shrink-0 ml-2"
                onClick={() => removeItem(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Grand total */}
          {lineItems.length > 0 && grandTotal > 0 && (
            <div className="flex justify-between items-center px-3 py-2 rounded-md bg-muted/50">
              <span className="text-sm font-medium text-muted-foreground">
                System Price ({lineItems.length} service{lineItems.length > 1 ? 's' : ''})
              </span>
              <span className="text-base font-bold">Ksh {grandTotal.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Service selector */}
      {adding ? (
        <Card>
          <CardContent className="p-3">
            <ServiceSearch
              services={availableServices}
              selectedService={null}
              onSelect={(s) => { if (s) addItem(s); else setAdding(false); }}
            />
            {lineItems.length > 0 && (
              <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setAdding(true)}
          disabled={availableServices.length === 0}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Another Service
        </Button>
      )}
    </div>
  );
}
