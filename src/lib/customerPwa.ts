/**
 * Customer-portal PWA wiring.
 *
 * The ERP has its own manifest scoped to /admin (see erpPwa.ts). This module
 * attaches a separate manifest scoped to the customer portal ("/"), so
 * installing from the marketplace opens the marketplace, while the ERP app
 * keeps opening /admin. Both use the same captured beforeinstallprompt event.
 */

const MANIFEST_ID = 'customer-manifest';
const MANIFEST_HREF = '/customer.webmanifest';
const DISMISS_KEY = 'ccs_customer_pwa_dismissed_at';
const INSTALLED_KEY = 'ccs_customer_pwa_installed';

export function attachCustomerManifest() {
  if (document.getElementById(MANIFEST_ID)) return;
  // Never allow both manifests at once — the ERP manager owns its own link.
  const link = document.createElement('link');
  link.id = MANIFEST_ID;
  link.rel = 'manifest';
  link.href = MANIFEST_HREF;
  document.head.appendChild(link);
}

export function detachCustomerManifest() {
  document.getElementById(MANIFEST_ID)?.remove();
}

export function isStandaloneApp(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function markCustomerInstallDismissed() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
}

export function markCustomerInstalled() {
  try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignore */ }
}

export function canShowCustomerInstallPrompt(): boolean {
  if (isStandaloneApp()) return false;
  try {
    if (localStorage.getItem(INSTALLED_KEY) === '1') return false;
  } catch { /* ignore */ }
  return true;
}

/** iOS Safari never fires beforeinstallprompt — we show manual instructions. */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  const classicIos = /iPad|iPhone|iPod/.test(ua);
  const ipadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return (classicIos || ipadOs) && !(window as any).MSStream;
}
