import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPending, markSynced, clearSynced } from '@/lib/offlineDb';
import { toast } from '@/hooks/use-toast';

export function useOfflineSync() {
  const syncAll = useCallback(async () => {
    const pending = await getPending();
    if (pending.length === 0) return;

    let synced = 0;
    for (const item of pending) {
      if (item.type === 'booking') {
        const { error } = await supabase.from('bookings').insert(item.data as any);
        if (!error) {
          await markSynced(item.localId);
          synced++;
        }
      }
    }

    if (synced > 0) {
      await clearSynced();
      toast({ title: 'Data synced successfully', description: `${synced} pending item(s) uploaded.` });
    }
  }, []);

  useEffect(() => {
    // Sync on mount if online
    if (navigator.onLine) syncAll();

    const handleOnline = () => syncAll();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncAll]);

  return { syncAll };
}
