import { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudUpload } from 'lucide-react';
import { onSyncStatus, getPendingCount, triggerSync } from '@/lib/offlineSyncEngine';

export default function NetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    getPendingCount().then(setPending).catch(() => {});
    const off = onSyncStatus(setPending);
    const goOnline = () => {
      setOnline(true);
      setShowRestored(true);
      triggerSync().catch(() => {});
      setTimeout(() => setShowRestored(false), 3000);
    };
    const goOffline = () => { setOnline(false); setShowRestored(false); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const t = window.setInterval(() => { getPendingCount().then(setPending).catch(() => {}); }, 5000);
    return () => {
      off();
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(t);
    };
  }, []);

  if ((online && !showRestored) || (online && pending > 0)) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 bg-destructive text-destructive-foreground">
      <WifiOff className="h-4 w-4" /> Offline Mode — changes will sync automatically{pending > 0 ? ` (${pending} queued)` : ''}
    </div>
  );
}
