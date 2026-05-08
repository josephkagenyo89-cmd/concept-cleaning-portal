import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, Loader2, ExternalLink, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { loadAllSettings } from '@/lib/settings';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId?: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  agentId?: string;
  agentName?: string;
  serviceName?: string;
}

export default function FeedbackDialog({
  open, onOpenChange, bookingId, clientId, clientName, clientPhone,
  agentId, agentName, serviceName,
}: Props) {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewUrl, setReviewUrl] = useState('');

  useEffect(() => {
    if (open) {
      setRating(0); setComment(''); setSubmitted(false); setHover(0);
      loadAllSettings().then(s => setReviewUrl(s.integrations?.google_review_url || ''));
    }
  }, [open]);

  const submit = async () => {
    if (!user || rating === 0) {
      toast({ title: 'Pick a star rating', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const role = isSuperAdmin ? 'super_admin' : isAdmin ? 'admin' : 'agent';
    const { error } = await supabase.from('customer_feedback' as any).insert({
      booking_id: bookingId || null,
      client_id: clientId || null,
      client_name: clientName,
      agent_id: agentId || null,
      agent_name: agentName || null,
      service_name: serviceName || null,
      rating,
      comment: comment.trim() || null,
      is_complaint: rating <= 2,
      submitted_by: user.id,
      submitted_by_role: role,
    } as any);
    setBusy(false);
    if (error) {
      toast({ title: 'Failed to save feedback', description: error.message, variant: 'destructive' });
      return;
    }
    setSubmitted(true);
    toast({ title: 'Feedback recorded', description: rating <= 2 ? 'Marked as complaint for follow-up.' : 'Thank you!' });
  };

  const openGoogleReview = () => {
    if (!reviewUrl) {
      toast({ title: 'Google review link not set', description: 'Add it in Settings → Integrations.', variant: 'destructive' });
      return;
    }
    window.open(reviewUrl, '_blank', 'noopener,noreferrer');
  };

  const shareReviewWhatsApp = () => {
    if (!reviewUrl || !clientPhone) return;
    let phone = clientPhone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
    if (!phone.startsWith('254')) phone = '254' + phone;
    const msg = encodeURIComponent(
      `Hello ${clientName},\n\nThank you for choosing Concept Cleaning Services. We'd love your feedback! Please leave us a Google review:\n\n${reviewUrl}\n\nThank you!`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Feedback</DialogTitle>
          <DialogDescription>{clientName}{serviceName ? ` · ${serviceName}` : ''}</DialogDescription>
        </DialogHeader>

        {!submitted ? (
          <div className="space-y-4">
            <div>
              <Label>How would the customer rate this service?</Label>
              <div className="flex gap-1 mt-2 justify-center">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(n)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        'h-9 w-9',
                        (hover || rating) >= n ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                      )}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <p className="text-center text-sm text-muted-foreground mt-1">
                  {['Very Poor', 'Poor', 'Average', 'Good', 'Excellent'][rating - 1]}
                </p>
              )}
            </div>
            <div>
              <Label>Comment (optional)</Label>
              <Textarea
                rows={3}
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Anything the customer wants to share..."
                maxLength={1000}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button onClick={submit} disabled={busy || rating === 0}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Feedback
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 text-center py-2">
            <div className="flex justify-center">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} className={cn('h-7 w-7', n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
              ))}
            </div>
            {rating >= 4 ? (
              <>
                <p className="text-sm">Great rating! Invite the customer to leave a Google review.</p>
                <div className="flex flex-col gap-2">
                  <Button onClick={openGoogleReview} disabled={!reviewUrl}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Leave Google Review
                  </Button>
                  {clientPhone && (
                    <Button variant="outline" onClick={shareReviewWhatsApp} disabled={!reviewUrl}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Send Review Link via WhatsApp
                    </Button>
                  )}
                  {!reviewUrl && (
                    <p className="text-xs text-muted-foreground">
                      Google review link not configured in Settings → Integrations.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Thank you. {rating <= 2 ? 'This has been flagged as a complaint for admin follow-up.' : 'Feedback saved internally.'}
              </p>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
