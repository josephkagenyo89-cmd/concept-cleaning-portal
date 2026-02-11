import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { getTier } from '@/lib/commission';
import TierBadge from '@/components/agent/TierBadge';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

export default function AdminAgents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<any[]>([]);

  const load = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    // Get cumulative revenue for each agent
    const { data: bookings } = await supabase.from('bookings').select('agent_id, price').eq('status', 'completed');
    const revenueMap: Record<string, number> = {};
    (bookings || []).forEach(b => {
      revenueMap[b.agent_id] = (revenueMap[b.agent_id] || 0) + Number(b.price);
    });
    setAgents((profiles || []).map(p => ({ ...p, cumulativeRevenue: revenueMap[p.user_id] || 0 })));
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (agentUserId: string, status: Database['public']['Enums']['agent_status']) => {
    const { error } = await supabase.from('profiles').update({ status }).eq('user_id', agentUserId);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }
    if (user) {
      await supabase.from('audit_logs').insert({
        admin_id: user.id,
        action: `agent_${status}`,
        target_type: 'profile',
        target_id: agentUserId,
      });
    }
    toast({ title: `Agent ${status}` });
    load();
  };

  const statusColor = (s: string) => {
    if (s === 'approved') return 'bg-success/20 text-success';
    if (s === 'suspended') return 'bg-destructive/20 text-destructive';
    return 'bg-warning/20 text-warning-foreground';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Agents</h1>
      {agents.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No agents</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {agents.map(a => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{a.full_name}</p>
                    <p className="text-xs text-muted-foreground">{a.phone} · {a.town_estate}</p>
                    <p className="text-xs text-muted-foreground">M-Pesa: {a.mpesa_number}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={cn('capitalize', statusColor(a.status))}>{a.status}</Badge>
                    <TierBadge tier={getTier(a.cumulativeRevenue)} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">Revenue: Ksh {a.cumulativeRevenue.toLocaleString()}</p>
                <div className="flex gap-2">
                  {a.status === 'pending' && (
                    <>
                      <Button size="sm" onClick={() => updateStatus(a.user_id, 'approved')}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => updateStatus(a.user_id, 'suspended')}>Reject</Button>
                    </>
                  )}
                  {a.status === 'approved' && (
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(a.user_id, 'suspended')}>Suspend</Button>
                  )}
                  {a.status === 'suspended' && (
                    <Button size="sm" onClick={() => updateStatus(a.user_id, 'approved')}>Activate</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
