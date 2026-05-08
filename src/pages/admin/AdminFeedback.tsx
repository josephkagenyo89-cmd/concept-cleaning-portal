import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Star, Search, AlertTriangle, Download, CalendarIcon, MessageSquareWarning } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type Feedback = {
  id: string;
  booking_id: string | null;
  client_id: string | null;
  client_name: string;
  agent_id: string | null;
  agent_name: string | null;
  service_name: string | null;
  rating: number;
  comment: string | null;
  is_complaint: boolean;
  created_at: string;
};

export default function AdminFeedback() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [complaintsOnly, setComplaintsOnly] = useState(false);
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('customer_feedback' as any).select('*').order('created_at', { ascending: false });
    if (ratingFilter !== 'all') q = q.eq('rating', Number(ratingFilter));
    if (complaintsOnly) q = q.eq('is_complaint', true);
    if (from) q = q.gte('created_at', from.toISOString());
    if (to) {
      const end = new Date(to); end.setHours(23, 59, 59);
      q = q.lte('created_at', end.toISOString());
    }
    const { data } = await q;
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ratingFilter, complaintsOnly, from, to]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(f =>
      f.client_name?.toLowerCase().includes(s) ||
      f.agent_name?.toLowerCase().includes(s) ||
      f.comment?.toLowerCase().includes(s) ||
      f.service_name?.toLowerCase().includes(s)
    );
  }, [items, search]);

  const stats = useMemo(() => {
    if (items.length === 0) return { avg: 0, count: 0, complaints: 0 };
    const sum = items.reduce((a, b) => a + b.rating, 0);
    return {
      avg: sum / items.length,
      count: items.length,
      complaints: items.filter(f => f.is_complaint).length,
    };
  }, [items]);

  const exportCsv = () => {
    const headers = ['Date', 'Client', 'Agent', 'Service', 'Rating', 'Complaint', 'Comment'];
    const rows = filtered.map(f => [
      format(new Date(f.created_at), 'yyyy-MM-dd HH:mm'),
      f.client_name, f.agent_name || '', f.service_name || '',
      f.rating, f.is_complaint ? 'Yes' : 'No',
      (f.comment || '').replace(/\n/g, ' '),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `feedback-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Customer Feedback</h1>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Average Rating</p>
          <p className="text-2xl font-bold flex items-center gap-1">
            {stats.avg.toFixed(1)}
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total Feedback</p>
          <p className="text-2xl font-bold">{stats.count}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Complaints</p>
          <p className="text-2xl font-bold text-destructive flex items-center gap-1">
            {stats.complaints}
            {stats.complaints > 0 && <AlertTriangle className="h-5 w-5" />}
          </p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search client, agent, comment..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5">5 ★</SelectItem>
            <SelectItem value="4">4 ★</SelectItem>
            <SelectItem value="3">3 ★</SelectItem>
            <SelectItem value="2">2 ★</SelectItem>
            <SelectItem value="1">1 ★</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant={complaintsOnly ? 'default' : 'outline'} onClick={() => setComplaintsOnly(v => !v)}>
          <MessageSquareWarning className="h-3 w-3 mr-1" /> Complaints
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[120px] text-xs", !from && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3 w-3" />{from ? format(from, 'dd/MM/yy') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={from} onSelect={setFrom} className="pointer-events-auto" /></PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("w-[120px] text-xs", !to && "text-muted-foreground")}>
              <CalendarIcon className="mr-1 h-3 w-3" />{to ? format(to, 'dd/MM/yy') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={to} onSelect={setTo} className="pointer-events-auto" /></PopoverContent>
        </Popover>
        {(from || to) && <Button size="sm" variant="ghost" onClick={() => { setFrom(undefined); setTo(undefined); }}>Clear</Button>}
      </div>

      {loading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No feedback yet</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <Card key={f.id} className={cn(f.is_complaint && 'border-destructive/40')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{f.client_name}</p>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={cn('h-4 w-4', n <= f.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
                        ))}
                      </div>
                      {f.is_complaint && <Badge variant="destructive">Complaint</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {f.service_name || '—'} · Agent: {f.agent_name || '—'}
                    </p>
                    {f.comment && <p className="text-sm pt-1 italic">"{f.comment}"</p>}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(f.created_at), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
