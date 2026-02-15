import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProfileHeader from '@/components/ProfileHeader';
import { BookOpen, Users, CreditCard, TrendingUp, Clock, UserCheck } from 'lucide-react';

export default function AdminOverview() {
  const [stats, setStats] = useState({ bookings: 0, revenue: 0, agents: 0, pendingApprovals: 0, pendingPayouts: 0, completedBookings: 0 });

  useEffect(() => {
    const load = async () => {
      const [bookings, agents, payouts, profiles] = await Promise.all([
        supabase.from('bookings').select('id, price, status'),
        supabase.from('user_roles').select('id').eq('role', 'agent'),
        supabase.from('payout_requests').select('id').eq('status', 'pending'),
        supabase.from('profiles').select('id, status'),
      ]);
      const allBookings = bookings.data || [];
      const revenue = allBookings.filter(b => b.status === 'completed').reduce((s, b) => s + Number(b.price), 0);
      const pendingApprovals = (profiles.data || []).filter(p => p.status === 'pending').length;

      setStats({
        bookings: allBookings.length,
        revenue,
        agents: (agents.data || []).length,
        pendingApprovals,
        pendingPayouts: (payouts.data || []).length,
        completedBookings: allBookings.filter(b => b.status === 'completed').length,
      });
    };
    load();
  }, []);

  const cards = [
    { label: 'Total Bookings', value: stats.bookings, icon: BookOpen, color: 'text-primary' },
    { label: 'Revenue', value: `Ksh ${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: 'text-success' },
    { label: 'Active Agents', value: stats.agents, icon: Users, color: 'text-info' },
    { label: 'Pending Approvals', value: stats.pendingApprovals, icon: UserCheck, color: 'text-warning' },
    { label: 'Pending Payouts', value: stats.pendingPayouts, icon: CreditCard, color: 'text-destructive' },
    { label: 'Completed', value: stats.completedBookings, icon: Clock, color: 'text-success' },
  ];

  return (
    <div>
      <ProfileHeader />
      <h1 className="text-2xl font-bold mb-6">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
