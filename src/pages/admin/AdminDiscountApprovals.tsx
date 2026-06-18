import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatDiscountLabel } from '@/lib/discounts';

export default function AdminDiscountApprovals() {
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .eq('discount_approval_status', 'pending')
      .order('created_at', { ascending: false });
    setRows((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (id: string, approve: boolean) => {
    const { error } = await supabase
      .from('bookings')
      .update({
        discount_approval_status: approve ? 'approved' : 'rejected',
        discount_approved_by: user?.id,
        discount_approved_at: new Date().toISOString(),
      } as any)
      .eq('id', id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: approve ? 'Discount approved' : 'Discount rejected' });
    load();
  };

  if (!isAdmin) {
    return <p className="p-6 text-sm text-muted-foreground">Admins only.</p>;
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Discount Approvals</h1>
      <p className="text-sm text-muted-foreground">
        Bookings with discounts requested by agents — pending your review.
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No pending discount approvals.</CardContent></Card>
      ) : (
        rows.map((b) => (
          <Card key={b.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">
                  {b.client_name}
                  {b.booking_code && (
                    <span className="ml-2 text-xs font-mono text-muted-foreground">{b.booking_code}</span>
                  )}
                </CardTitle>
                <Badge variant="outline">{formatDiscountLabel(b.discount_type, b.discount_value)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <div><span className="text-muted-foreground">Subtotal</span><br/>Ksh {Number(b.subtotal || 0).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Discount</span><br/>− Ksh {Number(b.discount_amount || 0).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Final</span><br/><b>Ksh {Number(b.price || 0).toLocaleString()}</b></div>
              </div>
              {b.discount_reason && (
                <p className="text-xs text-muted-foreground italic">Reason: {b.discount_reason}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Requested by {b.created_by_name} on {format(new Date(b.created_at), 'PPP')}
              </p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => decide(b.id, true)}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => decide(b.id, false)}>Reject</Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
