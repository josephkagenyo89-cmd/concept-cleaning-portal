import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Service {
  id: string;
  name: string;
  category: string;
  base_price: number;
  pricing_unit: string;
  input_type: string;
}

interface ServiceSearchProps {
  services: Service[];
  selectedService: Service | null;
  onSelect: (service: Service) => void;
}

export default function ServiceSearch({ services, selectedService, onSelect }: ServiceSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return services;
    const q = query.toLowerCase();
    return services.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [query, services]);

  const grouped = useMemo(() => {
    const groups: Record<string, Service[]> = {};
    filtered.forEach(s => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    return groups;
  }, [filtered]);

  const handleSelect = (service: Service) => {
    onSelect(service);
    setQuery('');
    setIsFocused(false);
  };

  const clearSelection = () => {
    onSelect(null as any);
    setQuery('');
  };

  if (selectedService) {
    return (
      <div className="flex items-center justify-between rounded-md border border-input bg-background px-3 py-2">
        <div>
          <p className="text-sm font-medium">{selectedService.name}</p>
          <p className="text-xs text-muted-foreground">{selectedService.category}</p>
        </div>
        <button type="button" onClick={clearSelection} className="rounded-full p-1 hover:bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search services... e.g. carpet, sofa, house"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className="pl-9"
        />
      </div>
      {isFocused && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">No services found</div>
          ) : (
            Object.entries(grouped).map(([cat, svcs]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">{cat}</div>
                {svcs.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={() => handleSelect(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between"
                  >
                    <span>{s.name}</span>
                    {Number(s.base_price) > 0 && (
                      <Badge variant="secondary" className="text-xs ml-2">
                        Ksh {Number(s.base_price).toLocaleString()}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
