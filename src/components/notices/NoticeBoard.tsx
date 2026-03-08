import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Pin, ExternalLink, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Notice {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'important' | 'urgent';
  is_pinned: boolean;
  created_at: string;
  requires_acknowledgement: boolean;
  link_url: string | null;
  link_label: string | null;
  open_in_new_tab: boolean;
}

const priorityStyles: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  important: 'bg-accent text-accent-foreground',
  normal: 'bg-info text-info-foreground',
};

export default function NoticeBoard() {
  const { user, roles } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: noticesData }, { data: acksData }] = await Promise.all([
        supabase
          .from('notices')
          .select('id, title, message, priority, is_pinned, created_at, requires_acknowledgement, link_url, link_label, open_in_new_tab')
          .eq('is_active', true)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('notice_acknowledgements')
          .select('notice_id')
          .eq('user_id', user.id),
      ]);
      setNotices((noticesData as Notice[]) || []);
      setAcknowledgedIds(new Set((acksData || []).map(a => a.notice_id)));
      setLoading(false);
    };
    load();
  }, [user]);

  const handleAcknowledge = async (noticeId: string) => {
    if (!user) return;
    setAcknowledgingId(noticeId);
    try {
      const userRole = roles.includes('super_admin') ? 'super_admin' : roles.includes('admin') ? 'admin' : 'agent';
      const { error } = await supabase.from('notice_acknowledgements').insert({
        notice_id: noticeId,
        user_id: user.id,
        role: userRole,
      });
      if (error) {
        if (error.code === '23505') {
          // Already acknowledged
          setAcknowledgedIds(prev => new Set([...prev, noticeId]));
          return;
        }
        throw error;
      }
      setAcknowledgedIds(prev => new Set([...prev, noticeId]));
      toast.success('Notice acknowledged');
    } catch (e: any) {
      toast.error(e.message || 'Failed to acknowledge');
    } finally {
      setAcknowledgingId(null);
    }
  };

  if (loading) return null;
  if (!notices.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Megaphone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Notice Board</h2>
      </div>
      <div className="space-y-2">
        {notices.map(n => {
          const isAcked = acknowledgedIds.has(n.id);
          return (
            <Card key={n.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {n.is_pinned && <Pin className="h-3.5 w-3.5 text-accent" />}
                      <Badge className={priorityStyles[n.priority]} variant="default">
                        {n.priority}
                      </Badge>
                      {n.requires_acknowledgement && isAcked && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Acknowledged
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                    {n.link_url && (
                      <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs" asChild>
                        <a
                          href={n.link_url}
                          {...(n.open_in_new_tab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                        >
                          {n.link_label || 'View More'}
                          {n.open_in_new_tab && <ExternalLink className="ml-1 h-3 w-3" />}
                        </a>
                      </Button>
                    )}
                    {n.requires_acknowledgement && !isAcked && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 text-xs h-7"
                        disabled={acknowledgingId === n.id}
                        onClick={() => handleAcknowledge(n.id)}
                      >
                        {acknowledgingId === n.id ? 'Acknowledging...' : 'I Acknowledge'}
                      </Button>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}