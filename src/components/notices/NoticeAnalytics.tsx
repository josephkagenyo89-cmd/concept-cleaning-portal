import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { BarChart3, Users, CheckCircle, Clock, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notice {
  id: string;
  title: string;
  priority: 'normal' | 'important' | 'urgent';
  target_role: string;
  requires_acknowledgement: boolean;
  acknowledgement_deadline: string | null;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

interface Ack {
  notice_id: string;
  user_id: string;
  role: string;
  acknowledged_at: string;
}

const priorityStyles: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  important: 'bg-accent text-accent-foreground',
  normal: 'bg-info text-info-foreground',
};

export default function NoticeAnalytics() {
  const { user, isSuperAdmin } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [acks, setAcks] = useState<Ack[]>([]);
  const [targetCounts, setTargetCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Fetch all notices (admins see all via RLS)
      const { data: noticeData } = await supabase
        .from('notices')
        .select('id, title, priority, target_role, requires_acknowledgement, acknowledgement_deadline, created_by, created_at, is_active')
        .order('created_at', { ascending: false });

      let filtered = (noticeData || []) as Notice[];
      // Admins can only see their own notices analytics
      if (!isSuperAdmin) {
        filtered = filtered.filter(n => n.created_by === user.id);
      }

      setNotices(filtered);

      // Fetch all acknowledgements
      const { data: ackData } = await supabase
        .from('notice_acknowledgements')
        .select('notice_id, user_id, role, acknowledged_at');
      setAcks((ackData || []) as Ack[]);

      // Get target role counts
      const [agentCount, adminCount] = await Promise.all([
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'agent'),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      ]);
      setTargetCounts({
        agent: agentCount.count || 0,
        admin: adminCount.count || 0,
        all: (agentCount.count || 0) + (adminCount.count || 0),
      });

      setLoading(false);
    };
    load();
  }, [user, isSuperAdmin]);

  if (loading) return <div className="text-muted-foreground text-sm p-4">Loading analytics...</div>;
  if (!notices.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Notice Analytics</h2>
      </div>
      <div className="space-y-3">
        {notices.filter(n => n.requires_acknowledgement).map(notice => {
          const noticeAcks = acks.filter(a => a.notice_id === notice.id);
          const total = targetCounts[notice.target_role] || 0;
          const acknowledged = noticeAcks.length;
          const pending = Math.max(0, total - acknowledged);
          const isOverdue = notice.acknowledgement_deadline && new Date(notice.acknowledgement_deadline) < new Date();

          return (
            <Card key={notice.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={priorityStyles[notice.priority]}>{notice.priority}</Badge>
                      {!notice.is_active && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <p className="font-medium text-sm">{notice.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notice.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-secondary rounded-md p-2">
                    <Users className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold">{total}</p>
                    <p className="text-xs text-muted-foreground">Targeted</p>
                  </div>
                  <div className="bg-secondary rounded-md p-2">
                    <CheckCircle className="h-3.5 w-3.5 mx-auto mb-1 text-success" />
                    <p className="text-lg font-bold">{acknowledged}</p>
                    <p className="text-xs text-muted-foreground">Acknowledged</p>
                  </div>
                  <div className="bg-secondary rounded-md p-2">
                    <Clock className={`h-3.5 w-3.5 mx-auto mb-1 ${isOverdue ? 'text-destructive' : 'text-warning'}`} />
                    <p className="text-lg font-bold">{pending}</p>
                    <p className="text-xs text-muted-foreground">{isOverdue ? 'Overdue' : 'Pending'}</p>
                  </div>
                </div>
                {notice.acknowledgement_deadline && (
                  <p className={`text-xs mt-2 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                    Deadline: {new Date(notice.acknowledgement_deadline).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
