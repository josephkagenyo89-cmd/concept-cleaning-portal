import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_SETTINGS, GeneralSettings } from '@/lib/settings';

const DEFAULT_PUBLIC_GENERAL = DEFAULT_SETTINGS.general;

/**
 * Loads only approved public branding/contact settings.
 * Never loads payment, CRM, commission, tax, notification, or system settings.
 */
export function usePublicSettings() {
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_PUBLIC_GENERAL);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('value')
        .eq('category', 'general')
        .maybeSingle();

      if (!mounted || error || !data?.value) return;
      setGeneral({ ...DEFAULT_PUBLIC_GENERAL, ...(data.value as Partial<GeneralSettings>) });
    };

    void load();
    return () => { mounted = false; };
  }, []);

  return { general };
}
