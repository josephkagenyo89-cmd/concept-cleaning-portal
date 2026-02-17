import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import TierBadge from '@/components/agent/TierBadge';
import StatusBadge from '@/components/agent/StatusBadge';
import { getTier, getTierProgress, TIER_THRESHOLDS } from '@/lib/commission';
import { PlusCircle, Wallet, TrendingUp, Calendar } from 'lucide-react';
import ProfileHeader from '@/components/ProfileHeader';
import NoticeBoard from '@/components/notices/NoticeBoard';

export default function AgentDashboard() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [cumulativeRevenue, setCumulativeRevenue] = useState(0);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [lastPayout, setLastPayout] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Wallet balance
      const { data: ledger } = await supabase
        .from('wallet_ledger')
        .select('type, amount')
        .eq('agent_id', user.id);
      const bal = (ledger || []).reduce((sum, e) => sum + (e.type === 'credit' ? Number(e.amount) : -Number(e.amount)), 0);
      setBalance(bal);

      // Total earnings from commissions
      const { data: comms } = await supabase
        .from('commissions')
        .select('amount, bonus_amount')
        .eq('agent_id', user.id);
      const earn = (comms || []).reduce((s, c) => s + Number(c.amount) + Number(c.bonus_amount), 0);
      setTotalEarnings(earn);

      // Cumulative revenue from completed bookings
      const { data: completed } = await supabase
        .from('bookings')
        .select('price')
        .eq('agent_id', user.id)
        .eq('status', 'completed');
      const rev = (completed || []).reduce((s, b) => s + Number(b.price), 0);
      setCumulativeRevenue(rev);

      // Recent bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, client_name, status, price, service_date, created_at')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentBookings(bookings || []);

      // Last payout
      const { data: payouts } = await supabase
        .from('payout_requests')
        .select('requested_at, status')
        .eq('agent_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(1);
      if (payouts && payouts.length > 0) {
        setLastPayout(payouts[0].requested_at);
      }

      setLoading(false);
    };
    load();
  }, [user]);

  const { tier, progress, nextThreshold } = getTierProgress(cumulativeRevenue);
  const tierRate = TIER_THRESHOLDS[tier].rate * 100;

  const nextPayoutDate = lastPayout
    ? new Date(new Date(lastPayout).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  const canRequestPayout = !nextPayoutDate || nextPayoutDate <= new Date();

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <ProfileHeader />
      <NoticeBoard />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/agent/book">
          <Button><PlusCircle className="mr-2 h-4 w-4" /> New Booking</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wallet className="h-3.5 w-3.5" /> Balance
            </div>
            <p className="text-xl font-bold">Ksh {balance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> Total Earnings
            </div>
            <p className="text-xl font-bold">Ksh {totalEarnings.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Progress */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Commission Tier</CardTitle>
            <TierBadge tier={tier} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{tierRate}% commission</span>
            <span>Ksh {cumulativeRevenue.toLocaleString()} / {nextThreshold.toLocaleString()}</span>
          </div>
          <Progress value={progress} className="h-2" />
          {tier !== 'gold' && (
            <p className="text-xs text-muted-foreground">
              Ksh {(nextThreshold - cumulativeRevenue).toLocaleString()} to next tier
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payout Info */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Next Payout Eligibility</p>
            <p className="text-sm font-medium">
              {canRequestPayout
                ? 'Eligible now'
                : nextPayoutDate
                  ? nextPayoutDate.toLocaleDateString()
                  : 'N/A'}
            </p>
          </div>
          <Link to="/agent/wallet">
            <Button size="sm" variant={canRequestPayout ? 'default' : 'outline'} disabled={!canRequestPayout}>
              Request Payout
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Bookings */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Bookings</h2>
        {recentBookings.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No bookings yet</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {recentBookings.map(b => (
              <Card key={b.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{b.client_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {new Date(b.service_date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">Ksh {Number(b.price).toLocaleString()}</p>
                    <StatusBadge status={b.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
