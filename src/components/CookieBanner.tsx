import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'ccs_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    setVisible(consent !== 'accepted' && consent !== 'rejected');
  }, []);

  const chooseConsent = (choice: 'accepted' | 'rejected') => {
    localStorage.setItem(CONSENT_KEY, choice);
    setVisible(false);
    window.dispatchEvent(new Event('ccs-cookie-consent-updated'));
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90] border-t bg-card/95 p-4 shadow-lg backdrop-blur" role="dialog" aria-label="Cookie and tracking preferences">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            We use essential cookies to operate this site. With your permission, Meta Pixel may use browsing activity to measure our advertising performance. Choose Accept all to allow optional tracking or Reject optional cookies to keep it disabled. Read more in our{' '}
            <Link to="/privacy-policy" className="font-medium text-primary hover:underline">Privacy Policy</Link>.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => chooseConsent('rejected')}>Reject optional cookies</Button>
          <Button type="button" onClick={() => chooseConsent('accepted')}>Accept all</Button>
        </div>
      </div>
    </div>
  );
}
