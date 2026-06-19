import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { formatDiscountLabel } from '@/lib/discounts';

type Decision = 'approve' | 'reject';

export default function AdminDiscountApprovals() {
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<any>(null);
  const [decision, setDecision] = useState<Decision>('approve');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const openDialog = (b: any, d: Decision) => {
    setActive(b);
    setDecision(d);
    setComment('');
    setOpen(true);
  };

  const confirm = async () => {
    if (!active) return;
    if (!comment.trim()) {
      toast({ title: 'Approval comment required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from('bookings')
      .update({
        discount_approval_status: decision === 'approve' ? 'approved' : 'rejected',
        discount_approved_by: user?.id,
        discount_approved_at: new Date().toISOString(),
        discount_approval_comment: comment.trim(),
      } as any)
      .eq('id', active.id);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: decision === 'approve' ? 'Discount approved' : 'Discount rejected' });
    setOpen(false);
    load();
  };

  if (!isAdmin) {
    return <p className="p-6 text-sm text-muted-foreground">Admins only.</p>;
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Discount Approvals</h1>
      <p className="text-sm text-muted-foreground">
        Bookings with discounts requested by agents — pending your review. Discounts only apply to invoices and receipts after approval.
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
                <div><span className="text-muted-foreground">Current Price</span><br/><b>Ksh {Number(b.price || 0).toLocaleString()}</b></div>
              </div>
              {b.discount_reason && (
                <p className="text-xs"><span className="text-muted-foreground">Reason:</span> {b.discount_reason}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Requested by {b.created_by_name} on {format(new Date(b.discount_requested_at || b.created_at), 'PPP p')}
              </p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => openDialog(b, 'approve')}>Approve Discount</Button>
                <Button size="sm" variant="outline" onClick={() => openDialog(b, 'reject')}>Reject Discount</Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision === 'approve' ? 'Approve' : 'Reject'} Discount</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="text-sm space-y-1">
              <p><b>{active.client_name}</b> — {formatDiscountLabel(active.discount_type, active.discount_value)}</p>
              <p className="text-muted-foreground">Discount amount: Ksh {Number(active.discount_amount || 0).toLocaleString()}</p>
              {active.discount_reason && <p className="text-muted-foreground italic">Requested reason: {active.discount_reason}</p>}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Approval Comment <span className="text-destructive">*</span></Label>
            <Textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={decision === 'approve' ? 'Reason for approving this discount…' : 'Reason for rejecting this discount…'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={confirm} disabled={submitting || !comment.trim()} variant={decision === 'reject' ? 'destructive' : 'default'}>
              {submitting ? 'Saving…' : (decision === 'approve' ? 'Approve' : 'Reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
