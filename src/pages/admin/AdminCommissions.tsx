import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import TierBadge from '@/components/agent/TierBadge';

export default function AdminCommissions() {
  const [entries, setEntries] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: ledger } = await supabase
        .from('wallet_ledger')
        .select('*')
        .order('created_at', { ascending: false });
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
      const profileMap: Record<string, string> = {};
      (profiles || []).forEach(p => { profileMap[p.user_id] = p.full_name; });
      setEntries((ledger || []).map(e => ({ ...e, agent_name: profileMap[e.agent_id] || 'Unknown' })));
    };
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Commission & Wallet Ledger</h1>
      {entries.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No entries</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <Card key={e.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{e.agent_name}</p>
                  <p className="text-xs text-muted-foreground">{e.description || e.type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</p>
                </div>
                <p className={`font-semibold text-sm ${e.type === 'credit' ? 'text-success' : 'text-destructive'}`}>
                  {e.type === 'credit' ? '+' : '-'}Ksh {Number(e.amount).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
