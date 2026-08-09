import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Award, Loader2, ShieldAlert } from 'lucide-react';
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

/**
 * Manual trigger button — issues a NEW Service Completion Certificate from the
 * booking. If the client signature is missing, Admins can bypass the signature
 * requirement; the bypass and its reason are recorded for audit.
 */
export default function GenerateCertificateButton({ bookingId, size = 'sm', variant = 'outline', className, onGenerated }: Props) {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [bypassOpen, setBypassOpen] = useState(false);
  const [bypassReason, setBypassReason] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCtx, setFeedbackCtx] = useState<{
    clientName: string; clientId?: string; clientPhone?: string;
    agentId?: string; agentName?: string; serviceName?: string;
  }>({ clientName: '' });

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

  const run = async (opts?: { bypassClientSignature?: boolean; bypassReason?: string }) => {
    if (!user) return;
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
        setBypassOpen(true);
        return;
      }
      toast({ title: 'Cannot generate certificate', description: res.reason, variant: 'destructive' });
      return;
    }
    toast({
      title: 'Certificate generated',
      description: `${res.certificate.certificate_number}${opts?.bypassClientSignature ? ' — client signature bypassed (recorded)' : ''}`,
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

  return (
    <>
      <Button size={size} variant={variant} onClick={handleClick} disabled={busy} className={className}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
        Generate Certificate
      </Button>

      <AlertDialog open={bypassOpen} onOpenChange={setBypassOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" /> Client signature missing
            </AlertDialogTitle>
            <AlertDialogDescription>
              As an administrator you may issue this certificate without the client's signature. The bypass, your name and
              the reason will be permanently recorded on the certificate for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label>Reason for bypass</Label>
            <Textarea
              value={bypassReason}
              onChange={(e) => setBypassReason(e.target.value)}
              placeholder="e.g. Client approved by phone; signature could not be captured on site."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!bypassReason.trim()}
              onClick={() => {
                setBypassOpen(false);
                void run({ bypassClientSignature: true, bypassReason: bypassReason.trim() });
              }}
            >
              Bypass & generate
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
