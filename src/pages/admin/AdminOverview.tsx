import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ProfileHeader from '@/components/ProfileHeader';
import PendingProfileEdits from '@/components/admin/PendingProfileEdits';
import { useAuth } from '@/contexts/AuthContext';
import {
  BookOpen, Users, CreditCard, TrendingUp, Clock, UserCheck, FileText, CalendarClock, ChevronRight,
} from 'lucide-react';

interface StatCard {
  label: string;
  value: string | number;
  icon: typeof BookOpen;
  color: string;
  to: string;
}

export default function AdminOverview() {
  const { profile, isSuperAdmin, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    bookings: 0, revenue: 0, agents: 0, pendingApprovals: 0, pendingPayouts: 0,
    completedBookings: 0, todayBookings: 0, newQuotations: 0,
  });

  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [bookings, agents, payouts, profiles, quotations] = await Promise.all([
        supabase.from('bookings').select('id, price, status, created_at'),
        supabase.from('user_roles').select('id').eq('role', 'agent'),
        supabase.from('payout_requests').select('id').eq('status', 'pending'),
        supabase.from('profiles').select('id, status'),
        supabase.from('quotations').select('id, created_at').gte('created_at', since),
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
        todayBookings: allBookings.filter(b => (b.created_at || '') >= since).length,
        newQuotations: (quotations.data || []).length,
      });
    };
    load();
  }, []);

  const roleLabel = role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Agent';

  const cards: StatCard[] = [
    { label: "Today's Bookings (24h)", value: stats.todayBookings, icon: CalendarClock, color: 'text-primary', to: '/admin/bookings' },
    { label: 'New Quotations (24h)', value: stats.newQuotations, icon: FileText, color: 'text-info', to: '/admin/quotations' },
    { label: 'Pending Agent Approvals', value: stats.pendingApprovals, icon: UserCheck, color: 'text-warning', to: '/admin/agents' },
    { label: 'Agent Payout Requests', value: stats.pendingPayouts, icon: CreditCard, color: 'text-destructive', to: '/admin/payouts' },
    { label: 'Total Bookings', value: stats.bookings, icon: BookOpen, color: 'text-primary', to: '/admin/bookings' },
    { label: 'Revenue', value: `Ksh ${stats.revenue.toLocaleString()}`, icon: TrendingUp, color: 'text-success', to: '/admin/erp' },
    { label: 'Active Agents', value: stats.agents, icon: Users, color: 'text-info', to: '/admin/agents' },
    { label: 'Completed Bookings', value: stats.completedBookings, icon: Clock, color: 'text-success', to: '/admin/bookings' },
  ];

  return (
    <div className="space-y-6">
      <ProfileHeader />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, <span className="font-medium text-foreground">{profile?.full_name || 'User'}</span>
          </p>
        </div>
        <Badge variant="secondary">{roleLabel}</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
            <Card className="h-full transition-colors hover:border-primary hover:bg-accent/40">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xl font-bold">{value}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <PendingProfileEdits />
    </div>
  );
}
