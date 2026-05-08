import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Award, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateServiceCertificate, downloadCertificate } from '@/lib/serviceCertificates';
import { toast } from '@/hooks/use-toast';
import FeedbackDialog from '@/components/feedback/FeedbackDialog';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  bookingId: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  className?: string;
  onGenerated?: () => void;
}

/**
 * Manual trigger button — issues a NEW Service Completion Certificate from the
 * booking. After successful generation, prompts customer feedback.
 */
export default function GenerateCertificateButton({ bookingId, size = 'sm', variant = 'outline', className, onGenerated }: Props) {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCtx, setFeedbackCtx] = useState<{
    clientName: string; clientId?: string; clientPhone?: string;
    agentId?: string; agentName?: string; serviceName?: string;
  }>({ clientName: '' });

  const handleClick = async () => {
    if (!user) return;
    if (!isAdmin && !isSuperAdmin) {
      toast({ title: 'Only Admins can issue certificates', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const res = await generateServiceCertificate({
      bookingId,
      generatedById: user.id,
      generatedByName: profile?.full_name || 'Admin',
      generatedByRole: isSuperAdmin ? 'super_admin' : 'admin',
    });
    setBusy(false);
    if (!res.ok || !res.certificate) {
      toast({ title: 'Cannot generate certificate', description: res.reason, variant: 'destructive' });
      return;
    }
    toast({ title: 'Certificate generated', description: res.certificate.certificate_number });
    downloadCertificate(res.certificate);
    onGenerated?.();

    // Load booking context for feedback
    const { data: b } = await supabase
      .from('bookings')
      .select('client_id, client_name, client_phone, agent_id, services(name)')
      .eq('id', bookingId)
      .maybeSingle();
    if (b) {
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
    }
  };

  return (
    <>
      <Button size={size} variant={variant} onClick={handleClick} disabled={busy} className={className}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
        Generate Certificate
      </Button>
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
