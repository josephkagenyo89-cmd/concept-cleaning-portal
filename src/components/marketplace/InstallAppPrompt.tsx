import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Download } from 'lucide-react';
import {
  attachCustomerManifest,
  canShowCustomerInstallPrompt,
  detachCustomerManifest,
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
 * Touch visitors tap the icon once to invoke the browser's native install prompt.
 */
export default function InstallAppPrompt() {
  const location = useLocation();
  const inStaffArea = location.pathname.startsWith('/admin') || location.pathname.startsWith('/agent');
  const isHome = location.pathname === '/';
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const collapseTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!isHome || inStaffArea) {
      setMountNode(null);
      return;
    }
    const updateTarget = () => {
      const targetId = window.matchMedia('(min-width: 1024px)').matches
        ? 'ccs-install-app-slot-desktop'
        : 'ccs-install-app-slot-mobile';
      setMountNode(document.getElementById(targetId));
    };
    updateTarget();
    // LandingPage is lazy-loaded, so observe the header slots appearing after this component mounts.
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    const media = window.matchMedia('(min-width: 1024px)');
    media.addEventListener('change', updateTarget);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', updateTarget);
    };
  }, [isHome, inStaffArea]);

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
    if (!deferred) return;

    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') {
        markCustomerInstalled();
        setInstalled(true);
      }
    } catch {
      // The browser owns the native installation UI.
    } finally {
      setDeferred(null);
    }
  };

  if (!isHome || inStaffArea || installed || isStandaloneApp() || !canShowCustomerInstallPrompt() || !mountNode || !deferred) {
    return null;
  }

  return createPortal(
    <div className="relative z-[70]">
      <button
        type="button"
        aria-label="Install App"
        aria-expanded={expanded}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setExpanded(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setExpanded(false);
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setExpanded(true);
        }}
        onBlur={() => {
          setExpanded(false);
        }}
        onClick={() => void install()}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-[#0F172A] px-3.5 text-white shadow-[0_8px_28px_rgba(15,23,42,0.28)] transition-all duration-200 hover:bg-[#1E293B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6B56D] focus-visible:ring-offset-2"
      >
        <Download className="h-5 w-5 shrink-0" />
        <span className={`overflow-hidden whitespace-nowrap text-sm font-bold transition-all duration-200 ${expanded ? 'max-w-24 opacity-100' : 'max-w-0 opacity-0'}`}>
          Install App
        </span>
      </button>
    </div>,
    mountNode,
  );
}
