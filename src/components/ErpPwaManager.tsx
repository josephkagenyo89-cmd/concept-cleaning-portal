import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { attachErpManifest, detachErpManifest, initErpInstallCapture } from '@/lib/erpPwa';

let captureStarted = false;

/**
 * Attaches the ERP web app manifest only while an authenticated staff user is
 * inside /admin. The marketplace and customer portal stay plain web pages.
 */
export default function ErpPwaManager() {
  const location = useLocation();
  const { isAdmin, isAgent } = useAuth();
  const isStaff = isAdmin || isAgent;
  const inErp = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (!captureStarted) {
      captureStarted = true;
      initErpInstallCapture();
    }
  }, []);

  useEffect(() => {
    if (isStaff && inErp) attachErpManifest();
    else detachErpManifest();
  }, [isStaff, inErp]);

  return null;
}
