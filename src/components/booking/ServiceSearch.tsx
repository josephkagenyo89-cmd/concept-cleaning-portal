import { useState, useMemo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Service {
  id: string;
  name: string;
  category: string;
  base_price: number;
}

interface ServiceSearchProps {
  services: Service[];
  selectedService: Service | null;
  onSelect: (service: Service) => void;
}

const CATEGORY_ORDER = [
  'Residential Cleaning',
  'Upholstery Cleaning',
  'Carpet & Rug Cleaning',
  'Car Interior Cleaning',
  'Commercial Cleaning',
  'Fumigation & Pest Control',
];

export default function ServiceSearch({ services, selectedService, onSelect }: ServiceSearchProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const isSearching = query.trim().length > 0;

  const filtered = useMemo(() => {
    if (!isSearching) return services;
    const q = query.toLowerCase();
    return services.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [query, services, isSearching]);

  const grouped = useMemo(() => {
    const groups: Record<string, Service[]> = {};
    const list = isSearching ? filtered : services;
    list.forEach(s => {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    });
    // Sort by CATEGORY_ORDER
    const sorted: [string, Service[]][] = [];
    CATEGORY_ORDER.forEach(cat => {
      if (groups[cat]) sorted.push([cat, groups[cat]]);
    });
    // Add any remaining categories not in the order
    Object.keys(groups).forEach(cat => {
      if (!CATEGORY_ORDER.includes(cat)) sorted.push([cat, groups[cat]]);
    });
    return sorted;
  }, [filtered, services, isSearching]);

  const handleSelect = (service: Service) => {
    onSelect(service);
    setQuery('');
    setIsFocused(false);
    setExpandedCategory(null);
  };

  const clearSelection = () => {
    onSelect(null as any);
    setQuery('');
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategory(prev => prev === cat ? null : cat);
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
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search services... e.g. carpet, sofa, house"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          className="pl-9"
        />
      </div>

      {/* Search results dropdown */}
      {isSearching && isFocused && (
        <div className="rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">No services found</div>
          ) : (
            grouped.map(([cat, svcs]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">{cat}</div>
                {svcs.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelect(s)}
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

      {/* Category browsing (when not searching) */}
      {!isSearching && (
        <div className="space-y-1">
          {grouped.map(([cat, svcs]) => (
            <div key={cat} className="rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <span>{cat}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{svcs.length}</Badge>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedCategory === cat ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {expandedCategory === cat && (
                <div className="border-t">
                  {svcs.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelect(s)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent flex items-center justify-between border-b last:border-b-0"
                    >
                      <span>{s.name}</span>
                      {Number(s.base_price) > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Ksh {Number(s.base_price).toLocaleString()}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
