import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Award, Loader2, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { generatePestCertificate, downloadPestCertificate } from '@/lib/pestCertificate';

export default function GeneratePestCertificateButton({ jobId, onIssued }: { jobId: string; onIssued?: () => void }) {
  const { user, profile, isAdmin, isSuperAdmin } = useAuth();
  const [warrantyDays, setWarrantyDays] = useState('30');
  const [freeRevisit, setFreeRevisit] = useState(true);
  const [safety, setSafety] = useState('Keep treated areas dry for 4 hours. Children & pets should avoid the area for 6 hours.');
  const [generating, setGenerating] = useState(false);

  const issue = async () => {
    if (!user) return;
    setGenerating(true);
    const res = await generatePestCertificate({
      pestJobId: jobId,
      warrantyDays: Number(warrantyDays) || 0,
      freeRevisitEligible: freeRevisit,
      safetyRecommendations: safety,
      generatedById: user.id,
      generatedByName: profile?.full_name || 'Admin',
      generatedByRole: isSuperAdmin ? 'super_admin' : isAdmin ? 'admin' : 'agent',
    });
    setGenerating(false);
    if (!res.ok) return toast({ title: 'Cannot issue certificate', description: res.reason, variant: 'destructive' });
    toast({ title: 'Pest certificate issued' });
    if (res.certificate) downloadPestCertificate(res.certificate);
    onIssued?.();
  };

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><Award className="h-4 w-4" /> Issue Pest Control Certificate</h3>
      <p className="text-xs text-muted-foreground">Requires a client signature on this job and a PAID linked invoice with M-Pesa code.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label>Warranty (days)</Label>
          <Input type="number" value={warrantyDays} onChange={(e) => setWarrantyDays(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <Checkbox id="rev" checked={freeRevisit} onCheckedChange={(v) => setFreeRevisit(!!v)} />
          <Label htmlFor="rev" className="cursor-pointer">Free revisit eligible during warranty</Label>
        </div>
      </div>
      <div>
        <Label>Safety recommendations</Label>
        <Textarea value={safety} onChange={(e) => setSafety(e.target.value)} rows={3} />
      </div>
      <Button onClick={issue} disabled={generating}>
        {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Generate & Download
      </Button>
    </Card>
  );
}
