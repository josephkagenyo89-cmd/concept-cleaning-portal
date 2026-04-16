import { useEffect, useState } from 'react';
import { AllSettings, DEFAULT_SETTINGS, loadAllSettings } from '@/lib/settings';

/**
 * React hook for accessing system settings. Loads once and caches.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AllSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadAllSettings()
      .then((s) => { if (mounted) { setSettings(s); setLoading(false); } })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const refresh = async () => {
    setLoading(true);
    const s = await loadAllSettings(true);
    setSettings(s);
    setLoading(false);
  };

  return { settings, loading, refresh };
}
