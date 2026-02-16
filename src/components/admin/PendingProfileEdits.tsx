import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, UserPen } from 'lucide-react';

interface EditRequest {
  id: string;
  user_id: string;
  proposed_data: {
    full_name?: string;
    phone?: string;
    town_estate?: string;
    mpesa_number?: string;
  };
  status: string;
  created_at: string;
  agent_name?: string;
  current_profile?: any;
  requester_role?: string;
}

export default function PendingProfileEdits() {
  const { isSuperAdmin } = useAuth();
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    const { data: edits } = await supabase
      .from('profile_edit_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (!edits || edits.length === 0) {
      setRequests([]);
      return;
    }

    // Fetch profiles and roles for requesters
    const userIds = edits.map(e => e.user_id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
      supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
    ]);

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p.full_name; });

    const roleMap: Record<string, string> = {};
    (roles || []).forEach(r => {
      // Keep highest role
      const current = roleMap[r.user_id];
      if (!current || (r.role === 'super_admin') || (r.role === 'admin' && current === 'agent')) {
        roleMap[r.user_id] = r.role;
      }
    });

    // Filter: Admins see agent edits, Super Admins see admin edits
    const filtered = edits.filter(e => {
      const role = roleMap[e.user_id] || 'agent';
      if (isSuperAdmin) return true; // Super admin sees all
      return role === 'agent'; // Regular admin only sees agent edits
    });

    setRequests(filtered.map(e => ({
      ...e,
      proposed_data: e.proposed_data as EditRequest['proposed_data'],
      agent_name: profileMap[e.user_id] || 'Unknown',
      requester_role: roleMap[e.user_id] || 'agent',
    })));
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessing(requestId);
    try {
      if (action === 'approve') {
        const { error } = await supabase.rpc('approve_profile_edit', { request_id: requestId });
        if (error) throw error;
        toast({ title: 'Approved', description: 'Profile has been updated.' });
      } else {
        const { error } = await supabase
          .from('profile_edit_requests')
          .update({ status: 'rejected', reviewer_id: (await supabase.auth.getUser()).data.user?.id, reviewed_at: new Date().toISOString() })
          .eq('id', requestId);
        if (error) throw error;
        toast({ title: 'Rejected', description: 'Edit request has been rejected.' });
      }
      await load();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setProcessing(null);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <UserPen className="h-5 w-5 text-warning" />
        <h2 className="text-lg font-semibold">
          {isSuperAdmin ? 'Pending Profile Edits' : 'Pending Agent Profile Edits'}
        </h2>
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          {requests.length}
        </Badge>
      </div>
      {requests.map(req => (
        <Card key={req.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{req.agent_name}</p>
                <Badge variant="secondary" className="text-xs capitalize">{req.requester_role?.replace('_', ' ')}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {req.proposed_data.full_name && (
                <div><span className="text-muted-foreground">Name:</span> {req.proposed_data.full_name}</div>
              )}
              {req.proposed_data.phone && (
                <div><span className="text-muted-foreground">Phone:</span> {req.proposed_data.phone}</div>
              )}
              {req.proposed_data.town_estate && (
                <div><span className="text-muted-foreground">Town:</span> {req.proposed_data.town_estate}</div>
              )}
              {req.proposed_data.mpesa_number && (
                <div><span className="text-muted-foreground">M-Pesa:</span> {req.proposed_data.mpesa_number}</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleAction(req.id, 'approve')}
                disabled={processing === req.id}
              >
                <CheckCircle className="h-4 w-4 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleAction(req.id, 'reject')}
                disabled={processing === req.id}
              >
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
