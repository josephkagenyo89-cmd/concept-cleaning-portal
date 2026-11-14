import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, Loader2, RotateCcw, Star } from 'lucide-react';
import { format } from 'date-fns';

interface BookingData {
  id: string;
  client_name: string;
  client_phone: string;
  price: number;
  service_date: string;
  line_items: any[];
  location: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function ClientSignature() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewPublicConsent, setReviewPublicConsent] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewSkipped, setReviewSkipped] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    if (!token) { setError('Invalid link'); setLoading(false); return; }
    fetch(`${SUPABASE_URL}/functions/v1/get-booking-for-signature?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error === 'already_signed') setError('You have already signed this document.');
        else if (data.error) setError(data.error);
        else setBooking(data.booking);
      })
      .catch(() => setError('Failed to load booking'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [booking]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setHasSigned(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const submit = async () => {
    if (!consent || !hasSigned || !booking) return;
    setSubmitting(true);
    try {
      const signature = canvasRef.current!.toDataURL('image/png');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-client-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signature, clientName: booking.client_name }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const submitReview = async () => {
    if (!reviewRating || !token || reviewSubmitting) return;
    setReviewSubmitting(true);
    setReviewError('');
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-client-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating: reviewRating, comment: reviewComment.trim(), publicDisplayConsent: reviewPublicConsent }),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Unable to submit feedback');
      setReviewSubmitted(true);
    } catch (err: any) {
      setReviewError(err.message || 'Unable to submit feedback. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 sm:p-8 space-y-5">
          <div className="text-center space-y-2">
            <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold">Signature Submitted</h1>
            <p className="text-sm text-muted-foreground">Thank you for confirming the service completion.</p>
          </div>
          {reviewSubmitted ? (
            <div className="rounded-xl bg-green-50 p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-semibold text-green-900">Thank you for your feedback!</p>
              <p className="mt-1 text-sm text-green-800">Your review has been received by Concept Cleaning Services.</p>
            </div>
          ) : reviewSkipped ? (
            <p className="rounded-xl bg-slate-100 p-4 text-center text-sm text-slate-600">Thank you for choosing Concept Cleaning Services. You can close this page.</p>
          ) : (
            <div className="space-y-4 border-t pt-4">
              <div className="text-center">
                <h2 className="font-bold text-lg">How was your experience?</h2>
                <p className="text-sm text-muted-foreground">We value your feedback and use it to improve our service.</p>
              </div>
              <div className="flex justify-center gap-2" role="group" aria-label="Rate your experience">
                {[1, 2, 3, 4, 5].map(value => (
                  <button key={value} type="button" onClick={() => setReviewRating(value)} aria-label={`${value} star${value === 1 ? '' : 's'}`} aria-pressed={reviewRating === value} className="rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                    <Star className={`h-8 w-8 ${value <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  </button>
                ))}
              </div>
              <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} maxLength={1200} rows={4} placeholder="Tell us what went well or what we could improve (optional)" className="w-full rounded-lg border bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
              <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <input type="checkbox" checked={reviewPublicConsent} onChange={e => setReviewPublicConsent(e.target.checked)} className="mt-1" />
                I agree that Concept Cleaning Services may display my review on its website. My contact details and booking information will not be published.
              </label>
              {reviewError && <p role="alert" className="text-sm text-destructive">{reviewError}</p>}
              <Button className="w-full" onClick={submitReview} disabled={!reviewRating || reviewSubmitting}>
                {reviewSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : 'Submit Feedback'}
              </Button>
              <Button className="w-full" variant="ghost" onClick={() => setReviewSkipped(true)} disabled={reviewSubmitting}>Skip for now</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold">Unable to Sign</h1>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    </div>
  );

  if (!booking) return null;

  const lineItems = Array.isArray(booking.line_items) ? booking.line_items : [];

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-8">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pt-4 pb-2">
          <h1 className="text-lg font-bold text-primary">Concept Cleaning Services</h1>
          <p className="text-xs text-muted-foreground">Service Completion Confirmation</p>
        </div>

        {/* Booking Details */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Client</span>
              <span className="font-medium">{booking.client_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono text-xs">{booking.id.slice(0, 8).toUpperCase()}</span>
            </div>
            {booking.service_date && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Date</span>
                <span>{format(new Date(booking.service_date), 'PPP')}</span>
              </div>
            )}

            {lineItems.length > 0 && (
              <div className="border-t pt-2 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Services Completed</p>
                {lineItems.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.name || item.service_name}</span>
                    <span>Ksh {Number(item.total || item.unitPrice || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-2 flex justify-between font-bold text-sm">
              <span>Total Amount</span>
              <span>Ksh {Number(booking.price).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Consent */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                I confirm that the cleaning services were completed satisfactorily and I am satisfied with the work done.
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Signature Pad */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Your Signature</p>
              <Button size="sm" variant="ghost" onClick={clearCanvas} className="h-7 text-xs">
                <RotateCcw className="h-3 w-3 mr-1" />Clear
              </Button>
            </div>
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className="w-full touch-none"
                style={{ height: 160 }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">Draw your signature above</p>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          className="w-full"
          size="lg"
          onClick={submit}
          disabled={!consent || !hasSigned || submitting}
        >
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : 'Submit Signature'}
        </Button>
      </div>
    </div>
  );
}
