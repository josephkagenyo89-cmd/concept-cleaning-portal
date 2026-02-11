import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '@/components/agent/StatusBadge';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

export default function AdminBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');

  const load = async () => {
    let q = supabase.from('bookings').select('*, services(name)').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('status', filter as any);
    const { data } = await q;
    // Load profiles for agent names
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
    const profileMap: Record<string, string> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p.full_name; });
    setBookings((data || []).map(b => ({ ...b, agent_name: profileMap[b.agent_id] || 'Unknown' })));
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: Database['public']['Enums']['booking_status'], agentId: string, price: number) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Failed', description: error.message, variant: 'destructive' });
      return;
    }

    // If completed, calculate and credit commission
    if (status === 'completed' && user) {
      // Get agent's cumulative revenue
      const { data: completed } = await supabase.from('bookings').select('price').eq('agent_id', agentId).eq('status', 'completed');
      const cumRev = (completed || []).reduce((s, b) => s + Number(b.price), 0);
      const { getTier, calculateCommission } = await import('@/lib/commission');
      const tier = getTier(cumRev);
      const comm = calculateCommission(price, tier);

      await supabase.from('commissions').insert({
        booking_id: id,
        agent_id: agentId,
        amount: comm.commission,
        bonus_amount: comm.bonus,
        tier_at_time: tier,
      });

      await supabase.from('wallet_ledger').insert({
        agent_id: agentId,
        type: 'credit',
        amount: comm.total,
        description: `Commission for booking`,
        reference_id: id,
      });

      // Audit
      await supabase.from('audit_logs').insert({
        admin_id: user.id,
        action: 'booking_completed',
        target_type: 'booking',
        target_id: id,
        details: { commission: comm.total, tier },
      });
    }

    toast({ title: `Booking ${status}` });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {bookings.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No bookings</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {bookings.map(b => (
            <Card key={b.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{b.client_name}</p>
                    <p className="text-xs text-muted-foreground">{b.client_phone} · {b.location}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Agent: {b.agent_name} · Service: {(b as any).services?.name || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">Date: {new Date(b.service_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">Ksh {Number(b.price).toLocaleString()}</p>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
                {b.status === 'pending' && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => updateStatus(b.id, 'confirmed', b.agent_id, Number(b.price))}>Confirm</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(b.id, 'cancelled', b.agent_id, Number(b.price))}>Cancel</Button>
                  </div>
                )}
                {b.status === 'confirmed' && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => updateStatus(b.id, 'completed', b.agent_id, Number(b.price))}>Mark Completed</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(b.id, 'cancelled', b.agent_id, Number(b.price))}>Cancel</Button>
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
