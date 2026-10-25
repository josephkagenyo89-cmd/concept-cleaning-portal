import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Award, Loader2, ShieldAlert, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateServiceCertificate, downloadCertificate } from '@/lib/serviceCertificates';
import { toast } from '@/hooks/use-toast';
import FeedbackDialog from '@/components/feedback/FeedbackDialog';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Props {
  bookingId: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  className?: string;
  onGenerated?: () => void;
}

export default function GenerateCertificateButton({ bookingId, size = 'sm', variant = 'outline', className, onGenerated }: Props) {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [bypassOpen, setBypassOpen] = useState(false);
  const [bypassReason, setBypassReason] = useState('');
  const [hasAdminSigned, setHasAdminSigned] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [feedbackCtx, setFeedbackCtx] = useState<{
    clientName: string; clientId?: string; clientPhone?: string;
    agentId?: string; agentName?: string; serviceName?: string;
  }>({ clientName: '' });

  useEffect(() => {
    if (!bypassOpen) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.round(140 * dpr);
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [bypassOpen]);

  const signaturePoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startSignature = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const p = signaturePoint(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const drawSignature = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext('2d');
    if (!ctx) return;
    const p = signaturePoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasAdminSigned(true);
  };

  const endSignature = () => { drawingRef.current = false; };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasAdminSigned(false);
  };

  const loadFeedbackContext = async () => {
    const { data: b } = await supabase
      .from('bookings')
      .select('client_id, client_name, client_phone, agent_id, services(name)')
      .eq('id', bookingId)
      .maybeSingle();
    if (!b) return;
    let agentName = '';
    if (b.agent_id) {
      const { data: ap } = await supabase.from('profiles').select('full_name').eq('user_id', b.agent_id).maybeSingle();
      agentName = ap?.full_name || '';
    }
    setFeedbackCtx({
      clientName: b.client_name,
      clientId: b.client_id || undefined,
      clientPhone: b.client_phone || undefined,
      agentId: b.agent_id || undefined,
      agentName,
      serviceName: (b as any).services?.name,
    });
    setFeedbackOpen(true);
  };

  const run = async (opts?: { bypassClientSignature?: boolean; bypassReason?: string; bypassAdminSignature?: string }) => {
    if (!user) return;
    if (opts?.bypassClientSignature && (!isSuperAdmin || !opts.bypassAdminSignature)) {
      toast({ title: 'Super Admin approval required', description: 'A Super Admin signature is required to waive the client signature.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const res = await generateServiceCertificate({
      bookingId,
      generatedById: user.id,
      generatedByName: profile?.full_name || 'Admin',
      generatedByRole: isSuperAdmin ? 'super_admin' : 'admin',
      ...opts,
    });
    setBusy(false);
    if (!res.ok || !res.certificate) {
      if (res.reason === 'Client signature is missing.') {
        if (!isSuperAdmin) {
          toast({ title: 'Client signature required', description: 'Only a Super Admin can approve a client-signature waiver.', variant: 'destructive' });
          return;
        }
        setBypassOpen(true);
        return;
      }
      toast({ title: 'Cannot generate certificate', description: res.reason, variant: 'destructive' });
      return;
    }
    setBypassOpen(false);
    toast({
      title: 'Certificate generated',
      description: res.certificate.certificate_number + (opts?.bypassClientSignature ? ' — Super Admin waiver and signature recorded' : ''),
    });
    downloadCertificate(res.certificate);
    onGenerated?.();
    await loadFeedbackContext();
  };

  const handleClick = async () => {
    if (!user) return;
    if (!isAdmin && !isSuperAdmin) {
      toast({ title: 'Only Admins can issue certificates', variant: 'destructive' });
      return;
    }
    await run();
  };

  const approveWaiver = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasAdminSigned || !bypassReason.trim()) return;
    const signature = canvas.toDataURL('image/png');
    setBypassOpen(false);
    void run({
      bypassClientSignature: true,
      bypassReason: bypassReason.trim(),
      bypassAdminSignature: signature,
    });
  };

  return (
    <>
      <Button size={size} variant={variant} onClick={handleClick} disabled={busy} className={className}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
        Generate Certificate
      </Button>

      <AlertDialog open={bypassOpen} onOpenChange={(open) => {
        setBypassOpen(open);
        if (!open) {
          setBypassReason('');
          setHasAdminSigned(false);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" /> Super Admin approval required
            </AlertDialogTitle>
            <AlertDialogDescription>
              The client has not signed. To issue this certificate, a Super Admin must provide a reason and draw their own approval signature. The waiver and approver details will be recorded on the certificate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label>Reason for waiving the client signature</Label>
            <Textarea
              value={bypassReason}
              onChange={(e) => setBypassReason(e.target.value)}
              placeholder="Explain why the client signature could not be captured."
              rows={3}
              maxLength={1000}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Super Admin approval signature</Label>
              <Button type="button" size="sm" variant="ghost" onClick={clearSignature} className="h-7 text-xs">
                <RotateCcw className="h-3 w-3 mr-1" />Clear
              </Button>
            </div>
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                className="w-full touch-none"
                style={{ height: 140 }}
                onPointerDown={startSignature}
                onPointerMove={drawSignature}
                onPointerUp={endSignature}
                onPointerCancel={endSignature}
                onPointerLeave={endSignature}
              />
            </div>
            <p className="text-xs text-muted-foreground">Sign in the box above. This is your approval signature, not the client's signature.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!bypassReason.trim() || !hasAdminSigned || busy}
              onClick={approveWaiver}
            >
              {busy ? 'Approving…' : 'Sign & Approve Waiver'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        bookingId={bookingId}
        clientId={feedbackCtx.clientId}
        clientName={feedbackCtx.clientName}
        clientPhone={feedbackCtx.clientPhone}
        agentId={feedbackCtx.agentId}
        agentName={feedbackCtx.agentName}
        serviceName={feedbackCtx.serviceName}
      />
    </>
  );
}
