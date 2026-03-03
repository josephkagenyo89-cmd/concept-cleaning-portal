import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface BlockingNotice {
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

export function useBlockingNotices() {
  const { user } = useAuth();
  const [blockingNotices, setBlockingNotices] = useState<BlockingNotice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlocking = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    // Get notices that require acknowledgement
    const { data: notices } = await supabase
      .from('notices')
      .select('id, title, message, priority, acknowledgement_deadline, is_blocking, requires_acknowledgement, link_url, link_label, open_in_new_tab')
      .eq('is_active', true)
      .eq('requires_acknowledgement', true);

    if (!notices?.length) { setBlockingNotices([]); setLoading(false); return; }

    // Get user's existing acknowledgements
    const { data: acks } = await supabase
      .from('notice_acknowledgements')
      .select('notice_id')
      .eq('user_id', user.id);

    const ackedIds = new Set((acks || []).map(a => a.notice_id));
    const unacked = (notices as BlockingNotice[]).filter(n => !ackedIds.has(n.id));

    // Show blocking ones first, then non-blocking
    const blocking = unacked.filter(n => n.is_blocking);
    setBlockingNotices(blocking.length ? blocking : unacked.filter(n => !n.is_blocking));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBlocking(); }, [fetchBlocking]);

  return { blockingNotices: blockingNotices.filter(n => n.is_blocking), pendingNotices: blockingNotices, refresh: fetchBlocking, loading };
}
