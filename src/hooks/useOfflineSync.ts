import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPending, markSynced, clearSynced } from '@/lib/offlineDb';
import { startSyncLoop, triggerSync } from '@/lib/offlineSyncEngine';
import { toast } from '@/hooks/use-toast';

export function useOfflineSync() {
  // Legacy: drain the old single-store pending_sync (bookings written by AgentBooking)
  const syncLegacy = useCallback(async () => {
    const pending = await getPending();
    if (pending.length === 0) return;
    let synced = 0;
    for (const item of pending) {
      if (item.type === 'booking') {
        const { error } = await supabase.from('bookings').insert(item.data as any);
        if (!error) { await markSynced(item.localId); synced++; }
      }
    }
    if (synced > 0) {
      await clearSynced();
      toast({ title: 'Data synced', description: `${synced} pending item(s) uploaded.` });
    }
  }, []);

  useEffect(() => {
    startSyncLoop();
    if (navigator.onLine) {
      syncLegacy();
      triggerSync();
    }
    const onOnline = () => { syncLegacy(); triggerSync(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [syncLegacy]);

  return { syncAll: async () => { await syncLegacy(); await triggerSync(); } };
}
