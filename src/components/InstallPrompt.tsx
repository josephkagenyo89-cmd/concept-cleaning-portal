import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, Zap, TrendingUp, Bell, Gift } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('pwa-dismissed');
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!dismissed) {
        setShow(true);
      } else {
        // Remind after 30s
        setTimeout(() => setShow(true), 30000);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-dismissed', '1');
    setShow(false);
  };

  if (!show) return null;

  const features = [
    { icon: Zap, text: 'Faster booking' },
    { icon: TrendingUp, text: 'Agent earnings tracking' },
    { icon: Bell, text: 'Real-time updates' },
    { icon: Gift, text: 'Exclusive offers' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Sparkles className="h-8 w-8 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Install Concept Cleaning Services</h1>
          <p className="text-sm text-muted-foreground mt-1">Get a better experience</p>
        </div>
        <div className="space-y-3 text-left">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              {text}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Button onClick={handleInstall} className="w-full" size="lg">
            <Download className="mr-2 h-4 w-4" /> Install Now
          </Button>
          <button onClick={handleDismiss} className="text-xs text-muted-foreground hover:underline">
            Continue in Browser
          </button>
        </div>
      </div>
    </div>
  );
}
