import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Download, MonitorSmartphone, CheckCircle2 } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { isInstallAvailable, isStandalone, onInstallAvailabilityChange, promptErpInstall } from '@/lib/erpPwa';

/** Settings → About: ERP information and the staff-only PWA install action. */
export default function AboutSettings() {
  const { settings } = useSettings();
  const [, setAvailable] = useState(isInstallAvailable());
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const off = onInstallAvailabilityChange(setAvailable);
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => { off(); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const install = async () => {
    const outcome = await promptErpInstall();
    if (outcome === 'accepted') {
      setInstalled(true);
      toast({ title: 'ERP app installed', description: 'Open Concept Cleaning ERP from your home screen or desktop.' });
    } else if (outcome === 'dismissed') {
      toast({ title: 'Installation cancelled' });
    } else {
      toast({
        title: 'Installation not available',
        description: 'Your browser has not offered installation yet. Try Chrome or Edge, or use the browser menu → Install app.',
      });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>About this ERP</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Application" value="Concept Cleaning ERP" />
          <Info label="Company" value={settings.general.company_name} />
          <Info label="Support phone" value={settings.general.phone} />
          <Info label="Support email" value={settings.general.email} />
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-primary" />
            <p className="font-medium">Install ERP App</p>
            {installed && <Badge variant="secondary">Installed</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            Install the staff ERP as a standalone app. It opens directly to the ERP dashboard and is
            available to authenticated staff only. The public marketplace stays a normal website.
          </p>
          {installed ? (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> The ERP app is already installed on this device.
            </p>
          ) : (
            <Button onClick={install}>
              <Download className="mr-2 h-4 w-4" /> Install ERP App
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  );
}
