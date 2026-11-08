import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  consumeGuestWhatsAppReturn,
  markGuestWhatsAppDeparture,
} from '@/lib/guestWhatsAppReturn';
import type { GuestWhatsAppRequest } from '@/lib/guestWhatsAppReturn';

export default function GuestWhatsAppReturnDialog() {
  const [request, setRequest] = useState<GuestWhatsAppRequest | null>(null);

  useEffect(() => {
    const checkForReturn = () => {
      const pending = consumeGuestWhatsAppReturn();
      if (pending) setRequest(pending);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        markGuestWhatsAppDeparture();
      } else {
        checkForReturn();
      }
    };

    window.addEventListener('pagehide', markGuestWhatsAppDeparture);
    window.addEventListener('pageshow', checkForReturn);
    window.addEventListener('focus', checkForReturn);
    document.addEventListener('visibilitychange', handleVisibility);

    checkForReturn();

    return () => {
      window.removeEventListener('pagehide', markGuestWhatsAppDeparture);
      window.removeEventListener('pageshow', checkForReturn);
      window.removeEventListener('focus', checkForReturn);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const close = () => setRequest(null);

  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center">
          <CheckCircle2 className="mb-2 h-14 w-14 text-green-600" />

          <DialogTitle className="text-xl">
            Your request has been received!
          </DialogTitle>

          <DialogDescription className="text-center">
            Thank you for choosing Concept Cleaning Services. Our team will
            review your request and contact you to confirm availability and
            the next steps.
          </DialogDescription>
        </DialogHeader>

        {request && (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">
                {request.requestType === 'booking'
                  ? 'Booking request'
                  : 'Quotation request'}
              </p>
              <p className="mt-1 text-muted-foreground">
                {request.serviceName}
              </p>
              <p className="mt-2 font-medium">
                Reference: {request.requestReference}
              </p>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Awaiting confirmation</p>
              <p className="mt-1">
                Your request is saved on our website. If WhatsApp opened,
                make sure you also tap Send on the prepared message.
              </p>
            </div>

            <Button asChild className="w-full">
              <Link to="/customer-auth?next=%2Fmy" onClick={close}>
                Create account / Sign in
              </Link>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={close}
            >
              Continue browsing
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
