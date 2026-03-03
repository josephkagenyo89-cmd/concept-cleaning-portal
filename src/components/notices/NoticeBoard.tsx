import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Pin, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';

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
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('notices')
        .select('id, title, message, priority, is_pinned, created_at, requires_acknowledgement, link_url, link_label, open_in_new_tab')
        .eq('is_active', true)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);
      setNotices((data as Notice[]) || []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return null;
  if (!notices.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Megaphone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Notice Board</h2>
      </div>
      <div className="space-y-2">
        {notices.map(n => (
          <Card key={n.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {n.is_pinned && <Pin className="h-3.5 w-3.5 text-accent" />}
                    <Badge className={priorityStyles[n.priority]} variant="default">
                      {n.priority}
                    </Badge>
                  </div>
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.message}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
