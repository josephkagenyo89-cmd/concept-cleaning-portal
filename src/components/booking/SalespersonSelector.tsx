import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Agent { id: string; full_name: string; }

interface SalespersonSelectorProps {
  value: { id: string; name: string; role: string };
  onChange: (val: { id: string; name: string; role: string }) => void;
}

export default function SalespersonSelector({ value, onChange }: SalespersonSelectorProps) {
  const { user, profile, isAdmin } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('status', 'approved');
      setAgents((data || []).map((p: any) => ({ id: p.user_id, full_name: p.full_name })));
    };
    load();
  }, [isAdmin]);

  // For agents: fixed to themselves
  if (!isAdmin) {
    return (
      <div className="space-y-1.5">
        <Label>Salesperson</Label>
        <div className="rounded-md border px-3 py-2 text-sm bg-muted">{profile?.full_name || 'You'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Salesperson</Label>
      <Select value={value.id} onValueChange={(id) => {
        if (id === user?.id) {
          onChange({ id, name: profile?.full_name || 'Admin', role: 'admin' });
        } else {
          const agent = agents.find(a => a.id === id);
          onChange({ id, name: agent?.full_name || '', role: 'agent' });
        }
      }}>
        <SelectTrigger><SelectValue placeholder="Select salesperson" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={user?.id || ''}>
            {profile?.full_name || 'Admin'} (You)
          </SelectItem>
          {agents.filter(a => a.id !== user?.id).map(a => (
            <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
