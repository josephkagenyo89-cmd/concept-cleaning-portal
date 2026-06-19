import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { formatDiscountLabel } from '@/lib/discounts';

export default function AdminDiscountReports() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('bookings')
        .select('id, client_name, client_id, booking_code, created_at, salesperson_name, salesperson_id, subtotal, price, discount_type, discount_value, discount_amount, discount_reason, discount_approval_status, discount_approval_comment, discount_approved_at, created_by_name')
        .not('discount_type', 'is', null)
        .gt('discount_amount', 0)
        .order('created_at', { ascending: false });
      setRows((data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const d = new Date(r.created_at).getTime();
      if (from && d < new Date(from).getTime()) return false;
      if (to && d > new Date(to).getTime() + 86400000) return false;
      return true;
    });
  }, [rows, from, to]);

  const byStatus = (s: string) => filtered.filter((r) => r.discount_approval_status === s);

  const groupBy = (key: 'salesperson_name' | 'client_name') => {
    const map = new Map<string, { count: number; total: number }>();
    filtered.forEach((r) => {
      const k = r[key] || 'Unknown';
      const cur = map.get(k) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(r.discount_amount || 0);
      map.set(k, cur);
    });
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  };

  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Admins only.</p>;

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-bold">{value}</p></CardContent></Card>
  );

  const Row = ({ r }: { r: any }) => (
    <Card>
      <CardContent className="p-3 text-sm space-y-1">
        <div className="flex justify-between gap-2">
          <div>
            <b>{r.client_name}</b>
            {r.booking_code && <span className="ml-2 text-xs font-mono text-muted-foreground">{r.booking_code}</span>}
          </div>
          <Badge variant={r.discount_approval_status === 'approved' ? 'default' : r.discount_approval_status === 'rejected' ? 'destructive' : 'outline'}>
            {r.discount_approval_status}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><span className="text-muted-foreground">Subtotal</span><br/>Ksh {Number(r.subtotal || 0).toLocaleString()}</div>
          <div><span className="text-muted-foreground">{formatDiscountLabel(r.discount_type, r.discount_value)}</span><br/>− Ksh {Number(r.discount_amount || 0).toLocaleString()}</div>
          <div><span className="text-muted-foreground">Final</span><br/>Ksh {Number(r.price || 0).toLocaleString()}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          By {r.salesperson_name || r.created_by_name} · {format(new Date(r.created_at), 'PPP')}
          {r.discount_approved_at && ` · Decided ${format(new Date(r.discount_approved_at), 'PPP')}`}
        </p>
        {r.discount_reason && <p className="text-xs italic">Reason: {r.discount_reason}</p>}
        {r.discount_approval_comment && <p className="text-xs italic text-muted-foreground">Approver comment: {r.discount_approval_comment}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">Discount Report</h1>

      <Card>
        <CardContent className="p-4 grid grid-cols-2 gap-3 max-w-md">
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pending" value={byStatus('pending').length} />
        <Stat label="Approved" value={byStatus('approved').length} />
        <Stat label="Rejected" value={byStatus('rejected').length} />
        <Stat label="Approved discount total" value={`Ksh ${byStatus('approved').reduce((s, r) => s + Number(r.discount_amount || 0), 0).toLocaleString()}`} />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <Tabs defaultValue="pending">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="salesperson">By Salesperson</TabsTrigger>
            <TabsTrigger value="client">By Client</TabsTrigger>
          </TabsList>

          {(['pending', 'approved', 'rejected'] as const).map((s) => (
            <TabsContent key={s} value={s} className="space-y-2">
              {byStatus(s).length === 0 ? <p className="text-sm text-muted-foreground">No records.</p>
                : byStatus(s).map((r) => <Row key={r.id} r={r} />)}
            </TabsContent>
          ))}

          <TabsContent value="salesperson" className="space-y-2">
            {groupBy('salesperson_name').map(([k, v]) => (
              <Card key={k}><CardContent className="p-3 flex justify-between text-sm"><span>{k}</span><span><b>Ksh {v.total.toLocaleString()}</b> · {v.count} discounts</span></CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="client" className="space-y-2">
            {groupBy('client_name').map(([k, v]) => (
              <Card key={k}><CardContent className="p-3 flex justify-between text-sm"><span>{k}</span><span><b>Ksh {v.total.toLocaleString()}</b> · {v.count} discounts</span></CardContent></Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
