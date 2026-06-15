import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { fetchListWithCache } from '@/lib/offlineRepo';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Search, PlusCircle, FileEdit } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  basePath: string;          // e.g. '/admin/bookings' or '/agent/book'
  scopeAgentId?: string;     // when set, only that agent's drafts (for agent role)
  title?: string;
}

export default function DraftBookingsList({ basePath, scopeAgentId, title = 'Draft Bookings' }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const load = async () => {
    const data = await fetchListWithCache<any>(
      'bookings',
      async () => {
        let q = supabase
          .from('bookings')
          .select('*')
          .order('last_modified_at', { ascending: false });
        if (scopeAgentId) q = q.eq('agent_id', scopeAgentId);
        return await q;
      },
      (r) => r.status === 'draft' && (!scopeAgentId || r.agent_id === scopeAgentId)
    );
    const drafts = (data || []).filter((b: any) => b.status === 'draft');
    setRows(drafts);
  };

  useEffect(() => { load(); }, [scopeAgentId]);

  const filtered = rows.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.booking_code?.toLowerCase().includes(s) ||
      b.client_name?.toLowerCase().includes(s) ||
      b.client_phone?.toLowerCase().includes(s) ||
      b.client_id?.toLowerCase().includes(s) ||
      b.id?.toLowerCase().includes(s)
    );
  });

  const resume = (b: any) => {
    const id = b.id || b.local_id;
    navigate(`${basePath}?draftId=${encodeURIComponent(id)}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <Button size="sm" onClick={() => navigate(basePath)}>
          <PlusCircle className="h-4 w-4 mr-1" /> New Booking
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by Booking ID, Client ID, name, or phone…"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            No draft bookings. Tap “New Booking” to start one — your draft is saved automatically.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => {
            const pct = Number(b.completion_percent || 0);
            return (
              <Card key={b.id || b.local_id} className="hover:bg-muted/40 cursor-pointer" onClick={() => resume(b)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{b.booking_code || '— pending sync —'}</p>
                      <p className="font-semibold truncate">{b.client_name || 'Untitled client'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.client_phone || '—'} · {b.location || '—'}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); resume(b); }}>
                      <FileEdit className="h-3 w-3 mr-1" /> Resume
                    </Button>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>{pct}% complete</span>
                      <span>
                        {b.last_modified_at
                          ? `Updated ${format(new Date(b.last_modified_at), 'PPp')}`
                          : b.created_at
                            ? `Created ${format(new Date(b.created_at), 'PPp')}`
                            : ''}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
