import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, X, Share, Sparkles } from 'lucide-react';
import {
  attachCustomerManifest,
  canShowCustomerInstallPrompt,
  detachCustomerManifest,
  isIos,
  isStandaloneApp,
  markCustomerInstallDismissed,
  markCustomerInstalled,
} from '@/lib/customerPwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Delay so the prompt appears after the visitor has had a look around. */
const SHOW_AFTER_MS = 12000;

/**
 * Professional, non-intrusive install invitation for the customer portal.
 * Never forces installation, and stays hidden once installed or dismissed.
 */
export default function InstallAppPrompt() {
  const location = useLocation();
  const inErp = location.pathname.startsWith('/admin');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  // Customer manifest is attached only outside the ERP so each app installs its own scope.
  useEffect(() => {
    if (inErp) detachCustomerManifest();
    else attachCustomerManifest();
  }, [inErp]);

  useEffect(() => {
    if (inErp) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      markCustomerInstalled();
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [inErp]);

  useEffect(() => {
    if (inErp || isStandaloneApp() || !canShowCustomerInstallPrompt()) return;
    // Android/desktop wait for the browser event; iOS shows manual instructions.
    if (!deferred && !isIos()) return;
    const id = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [deferred, inErp]);

  const dismiss = () => {
    markCustomerInstallDismissed();
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') markCustomerInstalled();
    else markCustomerInstallDismissed();
    setVisible(false);
    setDeferred(null);
  };

  if (!visible || inErp) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 px-4 md:bottom-6 md:left-auto md:right-6 md:w-96 md:px-0">
      <div className="relative rounded-2xl border bg-card p-4 shadow-xl">
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-market/10 text-market">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 pr-4">
            <p className="text-sm font-bold">Install our app</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Book faster, track your services and open your documents straight from your home screen.
            </p>

            {deferred ? (
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="bg-market text-market-foreground hover:bg-market/90" onClick={install}>
                  <Download className="mr-1.5 h-4 w-4" /> Install app
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>Not now</Button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Share className="h-3.5 w-3.5" /> Tap Share, then “Add to Home Screen”.
                </p>
                <Button size="sm" variant="ghost" onClick={dismiss}>Got it</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
