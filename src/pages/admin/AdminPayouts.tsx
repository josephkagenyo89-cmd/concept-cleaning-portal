import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/agent/StatusBadge';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

export default function AdminPayouts() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from('payout_requests')
      .select('*')
      .order('requested_at', { ascending: false });
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, mpesa_number');
    const profileMap: Record<string, any> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
    setPayouts((data || []).map(p => ({ ...p, profile: profileMap[p.agent_id] || {} })));
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (id: string, status: Database['public']['Enums']['payout_status'], agentId: string, amount: number) => {
    const { error } = await supabase.from('payout_requests').update({ status, processed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast({ title: 'Failed', variant: 'destructive' }); return; }

    if (status === 'approved') {
      await supabase.from('wallet_ledger').insert({
        agent_id: agentId,
        type: 'debit',
        amount,
        description: 'Payout approved',
        reference_id: id,
      });
    }

    if (user) {
      await supabase.from('audit_logs').insert({
        admin_id: user.id,
        action: `payout_${status}`,
        target_type: 'payout_request',
        target_id: id,
        details: { amount },
      });
    }

    toast({ title: `Payout ${status}` });
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Payout Management</h1>
      {payouts.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No payout requests</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {payouts.map(p => (
            <Card key={p.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{p.profile?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">M-Pesa: {p.profile?.mpesa_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.requested_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">Ksh {Number(p.amount).toLocaleString()}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                {p.status === 'pending' && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => handleAction(p.id, 'approved', p.agent_id, Number(p.amount))}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleAction(p.id, 'rejected', p.agent_id, Number(p.amount))}>Reject</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
