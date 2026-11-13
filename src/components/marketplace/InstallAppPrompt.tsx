import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, X } from 'lucide-react';
import {
  attachCustomerManifest,
  canShowCustomerInstallPrompt,
  detachCustomerManifest,
  isIos,
  isStandaloneApp,
  markCustomerInstalled,
} from '@/lib/customerPwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Homepage-only, compact PWA install control.
 * It expands on mouse hover/focus or briefly while the visitor scrolls.
 * Touch visitors tap once to reveal the label and again to install/open help.
 */
export default function InstallAppPrompt() {
  const location = useLocation();
  const inStaffArea = location.pathname.startsWith('/admin') || location.pathname.startsWith('/agent');
  const isHome = location.pathname === '/';
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);
  const collapseTimer = useRef<number | null>(null);

  useEffect(() => {
    if (inStaffArea) detachCustomerManifest();
    else attachCustomerManifest();
  }, [inStaffArea]);

  useEffect(() => {
    if (inStaffArea) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      markCustomerInstalled();
      setInstalled(true);
      setShowInstructions(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [inStaffArea]);

  useEffect(() => () => {
    if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current);
  }, []);

  useEffect(() => {
    if (!isHome || inStaffArea || isStandaloneApp()) return;
    const revealOnScroll = () => {
      setExpanded(true);
      if (collapseTimer.current !== null) window.clearTimeout(collapseTimer.current);
      collapseTimer.current = window.setTimeout(() => setExpanded(false), 1800);
    };
    window.addEventListener('scroll', revealOnScroll, { passive: true });
    return () => window.removeEventListener('scroll', revealOnScroll);
  }, [isHome, inStaffArea]);

  const install = async () => {
    if (!deferred) {
      setShowInstructions(true);
      setExpanded(true);
      return;
    }

    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') {
        markCustomerInstalled();
        setInstalled(true);
      } else {
        setShowInstructions(true);
      }
    } catch {
      setShowInstructions(true);
    } finally {
      setDeferred(null);
    }
  };

  if (!isHome || inStaffArea || installed || isStandaloneApp() || !canShowCustomerInstallPrompt()) {
    return null;
  }

  const instructions = isIos()
    ? 'In Safari, tap the Share icon, choose “Add to Home Screen”, then tap Add.'
    : 'Open your browser menu and choose “Install app” or “Add to Home screen”.';

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)_+_5.25rem)] right-4 z-[70] md:bottom-6">
      {showInstructions && (
        <div
          id="ccs-install-help"
          role="dialog"
          aria-label="How to install Concept Cleaning Services"
          className="absolute bottom-[calc(100%_+_0.75rem)] right-0 w-80 max-w-[calc(100vw_-_2rem)] rounded-2xl border border-[#E2E8F0] bg-white p-4 text-[#0F172A] shadow-2xl"
        >
          <button
            type="button"
            onClick={() => setShowInstructions(false)}
            aria-label="Close installation instructions"
            className="absolute right-2 top-2 rounded-full p-2 text-[#64748B] hover:bg-[#F1F5F9]"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="pr-6 text-sm font-extrabold">Install Concept Cleaning Services</p>
          <p className="mt-2 text-sm leading-6 text-[#475569]">{instructions}</p>
          <p className="mt-2 text-xs leading-5 text-[#64748B]">The app opens from your home screen like an app, without needing to search for the website again.</p>
        </div>
      )}

      <button
        type="button"
        aria-label="Install App"
        aria-expanded={expanded || showInstructions}
        aria-controls={showInstructions ? 'ccs-install-help' : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setExpanded(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse' && !showInstructions) setExpanded(false);
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setExpanded(true);
        }}
        onBlur={() => {
          if (!showInstructions) setExpanded(false);
        }}
        onClick={() => {
          if (!expanded) {
            setExpanded(true);
            return;
          }
          void install();
        }}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-[#0F172A] px-3.5 text-white shadow-[0_8px_28px_rgba(15,23,42,0.28)] transition-all duration-200 hover:bg-[#1E293B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6B56D] focus-visible:ring-offset-2"
      >
        <Download className="h-5 w-5 shrink-0" />
        <span className={`overflow-hidden whitespace-nowrap text-sm font-bold transition-all duration-200 ${expanded || showInstructions ? 'max-w-24 opacity-100' : 'max-w-0 opacity-0'}`}>
          Install App
        </span>
      </button>
    </div>
  );
}
