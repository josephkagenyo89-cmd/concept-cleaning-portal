import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, UserPlus, CheckCircle2, X, Loader2 } from 'lucide-react';
import CreateClientDialog from './CreateClientDialog';

export type SelectedClient = {
  id: string;
  client_code: string | null;
  full_name: string;
  phone: string;
  location: string | null;
};

type Props = {
  value: SelectedClient | null;
  onChange: (client: SelectedClient | null) => void;
};

export default function ClientSearchSelector({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SelectedClient[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 2 || value) {
      setResults([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const q = query.trim();
      const { data } = await supabase
        .from('clients')
        .select('id, client_code, full_name, phone, location')
        .or(`client_code.ilike.%${q}%,phone.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(8);
      setResults((data as any[]) || []);
      setSearching(false);
      setSearched(true);
    }, 300);
    return () => clearTimeout(t);
  }, [query, value]);

  if (value) {
    return (
      <Card className="p-3 bg-primary/5 border-primary/30">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate">{value.full_name}</p>
                {value.client_code && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {value.client_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{value.phone}</p>
              {value.location && <p className="text-xs text-muted-foreground truncate">{value.location}</p>}
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => onChange(null)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Client linked from CRM. Edit details in the CRM if needed.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Find Client</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Enter Client ID (CL-0001) or phone number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {results.length > 0 && (
        <Card className="divide-y max-h-64 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left p-3 hover:bg-muted/60 transition-colors"
              onClick={() => { onChange(c); setQuery(''); setResults([]); }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}</p>
                </div>
                {c.client_code && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {c.client_code}
                  </span>
                )}
              </div>
            </button>
          ))}
        </Card>
      )}

      {searched && !searching && results.length === 0 && query.trim().length >= 2 && (
        <Card className="p-3 bg-muted/30">
          <p className="text-sm mb-2">Client not found. Create new client?</p>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-3.5 w-3.5 mr-1" /> Create Client
          </Button>
        </Card>
      )}

      {!query && (
        <p className="text-xs text-muted-foreground">
          Search the CRM to link this booking to a client.
        </p>
      )}

      <CreateClientDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        prefillPhone={/^\d/.test(query.trim()) ? query.trim() : ''}
        onCreated={(c) => { onChange(c); setQuery(''); setResults([]); }}
      />
    </div>
  );
}
