import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import StatusBadge from '@/components/agent/StatusBadge';
import { toast } from '@/hooks/use-toast';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function AgentWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [lastPayout, setLastPayout] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: led } = await supabase
      .from('wallet_ledger')
      .select('*')
      .eq('agent_id', user.id)
      .order('created_at', { ascending: false });
    setLedger(led || []);
    const bal = (led || []).reduce((s, e) => s + (e.type === 'credit' ? Number(e.amount) : -Number(e.amount)), 0);
    setBalance(bal);

    const { data: pays } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('agent_id', user.id)
      .order('requested_at', { ascending: false });
    setPayouts(pays || []);
    if (pays && pays.length > 0) setLastPayout(pays[0].requested_at);
  };

  useEffect(() => { load(); }, [user]);

  const nextPayoutDate = lastPayout ? new Date(new Date(lastPayout).getTime() + 7 * 86400000) : null;
  const canRequest = !nextPayoutDate || nextPayoutDate <= new Date();

  const handleRequest = async () => {
    if (!user || !canRequest) return;
    const amt = Number(amount);
    if (amt <= 0 || amt > balance) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('payout_requests').insert({
      agent_id: user.id,
      amount: amt,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Request failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Payout requested!' });
      setAmount('');
      load();
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <h1 className="text-2xl font-bold">Wallet</h1>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 opacity-80 text-sm mb-1">
            <Wallet className="h-4 w-4" /> Available Balance
          </div>
          <p className="text-3xl font-bold">Ksh {balance.toLocaleString()}</p>
        </CardContent>
      </Card>

      {/* Payout Request */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Request Payout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!canRequest && nextPayoutDate && (
            <p className="text-sm text-muted-foreground">Next eligible: {nextPayoutDate.toLocaleDateString()}</p>
          )}
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label>Amount (Ksh)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} max={balance} placeholder="Enter amount" />
            </div>
            <Button className="self-end" onClick={handleRequest} disabled={!canRequest || loading || !amount}>
              {loading ? 'Sending...' : 'Request'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payout History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Payout Requests</h2>
        {payouts.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No payout requests</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {payouts.map(p => (
              <Card key={p.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Ksh {Number(p.amount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.requested_at).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Transaction History</h2>
        {ledger.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No transactions</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {ledger.map(e => (
              <Card key={e.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {e.type === 'credit'
                      ? <ArrowDownRight className="h-4 w-4 text-success" />
                      : <ArrowUpRight className="h-4 w-4 text-destructive" />
                    }
                    <div>
                      <p className="text-sm font-medium">{e.description || (e.type === 'credit' ? 'Commission' : 'Payout')}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className={cn('font-semibold text-sm', e.type === 'credit' ? 'text-success' : 'text-destructive')}>
                    {e.type === 'credit' ? '+' : '-'}Ksh {Number(e.amount).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
