import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function NetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };
    const goOffline = () => {
      setOnline(false);
      setShowRestored(false);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online && !showRestored) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 ${
      online
        ? 'bg-green-600 text-white'
        : 'bg-destructive text-destructive-foreground'
    }`}>
      {online ? (
        <>
          <Wifi className="h-4 w-4" />
          Back online — Data synced successfully
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          Offline Mode Active — Data will sync automatically
        </>
      )}
    </div>
  );
}
