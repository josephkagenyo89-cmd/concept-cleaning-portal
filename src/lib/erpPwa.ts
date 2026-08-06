/**
 * ERP-only PWA wiring.
 *
 * The installable app is scoped to /admin. The public marketplace and customer
 * portal stay ordinary browser pages: the manifest link is only attached while
 * an authenticated staff user is inside the ERP, so no install prompt appears
 * anywhere else.
 */

const MANIFEST_ID = 'erp-manifest';
const MANIFEST_HREF = '/admin.webmanifest';

export function attachErpManifest() {
  if (document.getElementById(MANIFEST_ID)) return;
  const link = document.createElement('link');
  link.id = MANIFEST_ID;
  link.rel = 'manifest';
  link.href = MANIFEST_HREF;
  document.head.appendChild(link);
}

export function detachErpManifest() {
  document.getElementById(MANIFEST_ID)?.remove();
}

/** True when the page is running as an installed standalone app. */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

function notify() {
  listeners.forEach((l) => l(!!deferredPrompt));
}

/** Captures the browser install event so Settings → About can trigger it later. */
export function initErpInstallCapture() {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function onInstallAvailabilityChange(cb: (available: boolean) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isInstallAvailable() {
  return !!deferredPrompt;
}

/** Triggers the native install prompt. Returns the outcome. */
export async function promptErpInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    deferredPrompt = null;
    notify();
  }
  return outcome;
}
