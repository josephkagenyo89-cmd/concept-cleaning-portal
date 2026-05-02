import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Award, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateServiceCertificate, downloadCertificate } from '@/lib/serviceCertificates';
import { toast } from '@/hooks/use-toast';

interface Props {
  bookingId: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  className?: string;
  onGenerated?: () => void;
}

/**
 * Manual trigger button — issues a NEW Service Completion Certificate from the
 * booking. Allows multiple certificates per booking (does NOT overwrite).
 * Validates: booking completed/locked + signatures + M-Pesa code.
 */
export default function GenerateCertificateButton({ bookingId, size = 'sm', variant = 'outline', className, onGenerated }: Props) {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const [busy, setBusy] = useState(false);

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
  };

  return (
    <Button size={size} variant={variant} onClick={handleClick} disabled={busy} className={className}>
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Award className="h-4 w-4 mr-2" />}
      Generate Certificate
    </Button>
  );
}
