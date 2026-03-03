import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Notice {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'important' | 'urgent';
  acknowledgement_deadline: string | null;
  is_blocking: boolean;
  link_url: string | null;
  link_label: string | null;
  open_in_new_tab: boolean;
}

interface BlockingNoticeModalProps {
  notices: Notice[];
  onAcknowledged: () => void;
}

const priorityStyles: Record<string, string> = {
  urgent: 'bg-destructive text-destructive-foreground',
  important: 'bg-accent text-accent-foreground',
  normal: 'bg-info text-info-foreground',
};

export default function BlockingNoticeModal({ notices, onAcknowledged }: BlockingNoticeModalProps) {
  const { user, roles } = useAuth();
  const [acknowledging, setAcknowledging] = useState(false);

  if (!notices.length || !user) return null;

  const notice = notices[0]; // one at a time

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      const userRole = roles.includes('super_admin') ? 'super_admin' : roles.includes('admin') ? 'admin' : 'agent';
      const { error } = await supabase.from('notice_acknowledgements').insert({
        notice_id: notice.id,
        user_id: user.id,
        role: userRole,
      });
      if (error) throw error;
      toast.success('Notice acknowledged');
      onAcknowledged();
    } catch (e: any) {
      toast.error(e.message || 'Failed to acknowledge');
    } finally {
      setAcknowledging(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <Badge className={priorityStyles[notice.priority]}>
              {notice.priority.toUpperCase()}
            </Badge>
          </div>
          <DialogTitle>{notice.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap pt-2">
            {notice.message}
          </DialogDescription>
        </DialogHeader>
        {notice.acknowledgement_deadline && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Deadline: {new Date(notice.acknowledgement_deadline).toLocaleDateString()}
          </div>
        )}
        <Button onClick={handleAcknowledge} disabled={acknowledging} className="w-full mt-2">
          {acknowledging ? 'Acknowledging...' : 'I Acknowledge'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
