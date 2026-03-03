import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Megaphone, Trash2, Link } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import CreateNoticeDialog from './CreateNoticeDialog';
import NoticeAnalytics from './NoticeAnalytics';

interface Notice {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'important' | 'urgent';
  target_role: string;
  is_pinned: boolean;
  is_active: boolean;
  requires_acknowledgement: boolean;
  is_blocking: boolean;
  created_at: string;
  created_by: string;
  link_url: string | null;
  link_label: string | null;
  open_in_new_tab: boolean;
}

const priorityStyles: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  important: 'bg-accent text-accent-foreground',
  normal: 'bg-info text-info-foreground',
};

export default function NoticeManagement() {
  const { user, isSuperAdmin } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });

    let filtered = (data || []) as Notice[];
    if (!isSuperAdmin) {
      filtered = filtered.filter(n => n.created_by === user?.id);
    }
    setNotices(filtered);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from('notices').update({ is_active: !current }).eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    setNotices(ns => ns.map(n => n.id === id ? { ...n, is_active: !current } : n));
  };

  const deleteNotice = async (id: string) => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    setNotices(ns => ns.filter(n => n.id !== id));
    toast.success('Notice deleted');
  };

  if (loading) return <div className="text-muted-foreground text-sm p-4">Loading notices...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Notice Management</h2>
        </div>
        <CreateNoticeDialog onCreated={load} />
      </div>

      <div className="space-y-2">
        {notices.map(n => (
          <Card key={n.id} className={!n.is_active ? 'opacity-60' : ''}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={priorityStyles[n.priority]}>{n.priority}</Badge>
                    <Badge variant="outline">{n.target_role}</Badge>
                    {n.is_blocking && <Badge variant="destructive">Blocking</Badge>}
                    {n.requires_acknowledgement && <Badge variant="secondary">Ack Required</Badge>}
                    {n.link_url && <Badge variant="outline" className="gap-1"><Link className="h-3 w-3" />Link</Badge>}
                  </div>
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={n.is_active} onCheckedChange={() => toggleActive(n.id, n.is_active)} />
                  <Button variant="ghost" size="icon" onClick={() => deleteNotice(n.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!notices.length && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">No notices created yet</CardContent></Card>
        )}
      </div>

      <NoticeAnalytics />
    </div>
  );
}
