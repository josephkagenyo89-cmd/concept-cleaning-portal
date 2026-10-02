import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ProfileHeader from '@/components/ProfileHeader';
import PendingProfileEdits from '@/components/admin/PendingProfileEdits';
import { useAuth } from '@/contexts/AuthContext';
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, Bell, BookOpen,
  CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Clock3,
  CreditCard, FileText, Plus, RefreshCw, Search, TrendingUp,
  UserCheck, UserPlus, Users, WalletCards,
} from 'lucide-react';

interface Booking {
  id: string;
  booking_code?: string | null;
  price: number | null;
  status: string;
  created_at: string;
}

const money = (value: number) =>
  `KSh ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-KE', { day: '2-digit', month: 'short' }).format(new Date(value));

export default function AdminOverview() {
  const { profile, isSuperAdmin, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    bookings: 0, revenue: 0, agents: 0, pendingApprovals: 0,
    pendingPayouts: 0, completedBookings: 0, todayBookings: 0, newQuotations: 0,
  });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);

  const load = async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const todayIso = startOfDay.toISOString();

    const [bookings, agents, payouts, profiles, quotations] = await Promise.all([
      supabase.from('bookings').select('id, booking_code, price, status, created_at').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('id').eq('role', 'agent'),
      supabase.from('payout_requests').select('id').eq('status', 'pending'),
      supabase.from('profiles').select('id, status'),
      supabase.from('quotations').select('id, created_at').gte('created_at', todayIso),
    ]);

    const allBookings = (bookings.data || []) as Booking[];
    const completed = allBookings.filter((b) => b.status === 'completed');
    const revenue = completed.reduce((sum, b) => sum + Number(b.price || 0), 0);

    setStats({
      bookings: allBookings.length,
      revenue,
      agents: (agents.data || []).length,
      pendingApprovals: (profiles.data || []).filter((p) => p.status === 'pending').length,
      pendingPayouts: (payouts.data || []).length,
      completedBookings: completed.length,
      todayBookings: allBookings.filter((b) => b.created_at >= todayIso).length,
      newQuotations: (quotations.data || []).length,
    });
    setRecentBookings(allBookings.slice(0, 6));
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { void load(); }, []);

  const roleLabel = isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrator' : 'Agent';

  const actions = [
    { label: 'New Lead', text: 'Add prospect to CRM', icon: UserPlus, to: '/admin/leads' },
    { label: 'Book Service', text: 'Create customer booking', icon: CalendarDays, to: '/admin/book-service' },
    { label: 'Create Quote', text: 'Prepare quotation', icon: ClipboardList, to: '/admin/quotations' },
    { label: 'View Invoices', text: 'Review billing', icon: FileText, to: '/admin/erp/invoices' },
  ];

  if (loading) {
    return <div className="space-y-6"><ProfileHeader /><div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">Loading business workspace…</div></div>;
  }

  return (
    <div className="w-full space-y-4 pb-6 sm:space-y-5 sm:pb-8">
      <ProfileHeader />

      <div className="flex flex-col gap-3 border-b pb-4 sm:gap-4 sm:pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground sm:gap-2 sm:text-xs">
            <span>Home</span><ChevronRight className="h-3.5 w-3.5" /><span className="text-foreground">Overview</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Business Overview</h1>
            <Badge variant="secondary" className="font-normal">{roleLabel}</Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
            Welcome back, <span className="font-medium text-foreground">{profile?.full_name || 'User'}</span>. Manage the business from one connected workspace.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" asChild><Link to="/admin/book-service"><Plus className="mr-2 h-4 w-4" /> New Booking</Link></Button>
        </div>
      </div>

      <div className="flex min-h-11 items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Link to="/admin/clients" className="flex-1 text-sm text-muted-foreground hover:text-foreground">
          Search customers, leads, bookings and services…
        </Link>
        <kbd className="hidden rounded border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">Ctrl K</kbd>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
        {[
          ['Bookings Today', stats.todayBookings, 'New activity today', CalendarDays, '/admin/bookings'],
          ['New Quotations', stats.newQuotations, 'Created today', FileText, '/admin/quotations'],
          ['Completed Revenue', money(stats.revenue), 'From completed bookings', TrendingUp, '/admin/erp'],
          ['Total Customers Activity', stats.bookings, 'Bookings in system', Users, '/admin/bookings'],
        ].map(([label, value, note, Icon, to]) => (
          <Link key={String(label)} to={String(to)}>
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-1.5 text-xl font-semibold tracking-tight sm:mt-2 sm:text-2xl">{value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{note}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3 sm:gap-5">
        <Card className="xl:col-span-2 min-w-0">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Business Performance</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Core operating indicators across the ERP</p>
            </div>
            <Button variant="ghost" size="sm" asChild><Link to="/admin/analytics">Analytics <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
            {[
              ['Total Bookings', stats.bookings, BookOpen],
              ['Completed', stats.completedBookings, CheckCircle2],
              ['Active Agents', stats.agents, Users],
              ['Pending Payouts', stats.pendingPayouts, CreditCard],
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-lg border bg-muted/20 p-3 sm:p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div>
                <p className="mt-2 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Needs Attention</CardTitle>
            <p className="text-xs text-muted-foreground">Work queues requiring action</p>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              ['Agent approvals', 'Pending review', stats.pendingApprovals, UserCheck, '/admin/agents'],
              ['Payout requests', 'Awaiting processing', stats.pendingPayouts, WalletCards, '/admin/payouts'],
              ['New quotations', 'Created today', stats.newQuotations, FileText, '/admin/quotations'],
              ['Completed jobs', 'Ready for follow-up', stats.completedBookings, CheckCircle2, '/admin/bookings'],
            ].map(([label, text, value, Icon, to]) => (
              <Link key={String(label)} to={String(to)} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{text}</p></div>
                </div>
                <Badge variant={Number(value) > 0 ? 'default' : 'secondary'}>{value}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
          {actions.map(({ label, text, icon: Icon, to }) => (
            <Link key={label} to={to} className="group min-w-0 rounded-lg border p-3 transition-colors sm:p-4 hover:border-primary/40 hover:bg-muted/40">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              </div>
              <p className="mt-3 text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">{text}</p>
            </Link>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2 sm:gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div><CardTitle className="text-base">Recent Bookings</CardTitle><p className="mt-1 text-xs text-muted-foreground">Latest customer transactions</p></div>
            <Button variant="ghost" size="sm" asChild><Link to="/admin/bookings">View all</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentBookings.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No bookings yet.</div> : (
              <div className="divide-y">
                {recentBookings.map((booking) => (
                  <Link key={booking.id} to={`/admin/bookings/${booking.id}`} className="flex min-w-0 items-center justify-between gap-2 px-3 py-3 hover:bg-muted/40 sm:gap-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><BookOpen className="h-4 w-4" /></div>
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{booking.booking_code || 'Booking'}</p><p className="text-xs text-muted-foreground">{dateLabel(booking.created_at)}</p></div>
                    </div>
                    <div className="max-w-[42%] text-right"><Badge variant="outline" className="capitalize">{booking.status.replace(/_/g, ' ')}</Badge><p className="mt-1 text-xs font-medium">{money(Number(booking.price || 0))}</p></div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Operational Snapshot</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">At-a-glance control of the business</p>
          </CardHeader>
          <CardContent className="space-y-2.5 sm:space-y-3">
            {[
              ['Today’s bookings', stats.todayBookings, '/admin/bookings', CalendarDays],
              ['Completed bookings', stats.completedBookings, '/admin/bookings', CheckCircle2],
              ['Agent approvals', stats.pendingApprovals, '/admin/agents', UserCheck],
              ['Pending payouts', stats.pendingPayouts, '/admin/payouts', WalletCards],
            ].map(([label, value, to, Icon]) => (
              <Link key={String(label)} to={String(to)} className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/40">
                <div className="flex items-center gap-3"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{label}</span></div>
                <span className="text-sm font-semibold">{value}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <PendingProfileEdits />
    </div>
  );
}
