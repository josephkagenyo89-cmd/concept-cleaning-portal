import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Bug, Loader2, RotateCcw, Save, Receipt, FileText } from 'lucide-react';
import PestInspectionForm from '@/components/pest/PestInspectionForm';
import PestTreatmentForm from '@/components/pest/PestTreatmentForm';
import PestAreasManager from '@/components/pest/PestAreasManager';
import PestFollowupsManager from '@/components/pest/PestFollowupsManager';
import PestPhotosUploader from '@/components/pest/PestPhotosUploader';
import GeneratePestCertificateButton from '@/components/pest/GeneratePestCertificateButton';
import FeedbackDialog from '@/components/feedback/FeedbackDialog';
import { toast } from '@/hooks/use-toast';

export default function AdminPestJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, isAdmin } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [lastCert, setLastCert] = useState<{ bookingId: string | null; clientId: string | null; clientName: string } | null>(null);
  const sigRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from('pest_jobs').select('*').eq('id', id).maybeSingle();
    setJob(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const initCanvas = () => {
    const c = sigRef.current; if (!c) return;
    const r = c.getBoundingClientRect();
    c.width = r.width * 2; c.height = r.height * 2;
    const ctx = c.getContext('2d')!;
    ctx.scale(2, 2); ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a1a';
  };
  const pos = (e: any) => {
    const c = sigRef.current!; const r = c.getBoundingClientRect();
    const t = e.touches?.[0];
    return { x: (t ? t.clientX : e.clientX) - r.left, y: (t ? t.clientY : e.clientY) - r.top };
  };
  const start = (e: any) => { e.preventDefault(); setDrawing(true); const p = pos(e); const ctx = sigRef.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e: any) => { if (!drawing) return; e.preventDefault(); const p = pos(e); const ctx = sigRef.current!.getContext('2d')!; ctx.lineTo(p.x, p.y); ctx.stroke(); setHasInk(true); };
  const end = () => setDrawing(false);
  const clear = () => { const c = sigRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setHasInk(false); };
  useEffect(() => { setTimeout(initCanvas, 50); }, [job?.id]);

  const saveSignature = async () => {
    if (!hasInk) return toast({ title: 'Please sign first', variant: 'destructive' });
    setSaving(true);
    const dataUrl = sigRef.current!.toDataURL('image/png');
    const { error } = await (supabase as any).from('pest_jobs').update({
      client_signature: dataUrl, client_signed_at: new Date().toISOString(),
    }).eq('id', id);
    setSaving(false);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    toast({ title: 'Client signature saved' });
    load();
  };

  const updateField = async (patch: any) => {
    setSaving(true);
    await (supabase as any).from('pest_jobs').update(patch).eq('id', id);
    setSaving(false); load();
  };

  const createInvoice = async () => {
    if (!job) return;
    setSaving(true);
    const { data: numRes } = await (supabase as any).rpc('next_invoice_number');
    const invoice_number = (numRes as string) || `CCS-INV-${Date.now()}`;
    const { data: inv, error } = await (supabase as any).from('invoices').insert({
      invoice_number,
      client_name: job.client_name,
      client_phone: job.client_phone,
      client_id: job.client_id,
      service: `Pest Control – ${job.pest_type || 'Treatment'}`,
      amount: Number(job.price) || 0,
      payment_status: 'unpaid',
      created_by: user!.id,
      notes: `Pest job: ${id}`,
    }).select('id, invoice_number').single();
    setSaving(false);
    if (error) return toast({ title: error.message, variant: 'destructive' });
    await (supabase as any).from('pest_jobs').update({ invoice_id: (inv as any).id }).eq('id', id);
    toast({ title: 'Invoice created', description: (inv as any).invoice_number });
    load();
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!job) return <p className="p-4">Pest job not found.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/admin/pest"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
        <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>{job.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bug className="h-5 w-5" /> {job.client_name}</CardTitle>
          <p className="text-sm text-muted-foreground">{job.pest_type || '—'} · {job.service_date} · KES {Number(job.price).toLocaleString()}</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-muted-foreground">Phone</span><p>{job.client_phone || '—'}</p></div>
          <div><span className="text-muted-foreground">Location</span><p>{job.client_location || '—'}</p></div>
          <div><span className="text-muted-foreground">Infestation</span><p className="capitalize">{job.infestation_level}</p></div>
          <div className="md:col-span-3 flex flex-wrap gap-2">
            {!job.invoice_id ? (
              <Button size="sm" variant="outline" onClick={createInvoice} disabled={saving}>
                <Receipt className="h-4 w-4 mr-1" /> Create Invoice
              </Button>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link to="/admin/erp/invoices"><FileText className="h-4 w-4 mr-1" /> Open Invoice</Link>
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-xs">Price</Label>
              <Input type="number" defaultValue={job.price} className="h-8 w-28"
                onBlur={(e) => updateField({ price: Number(e.target.value) || 0 })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="inspection">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="inspection">Inspection</TabsTrigger>
          <TabsTrigger value="treatment">Treatment</TabsTrigger>
          <TabsTrigger value="areas">Areas</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="signature">Signature</TabsTrigger>
          <TabsTrigger value="certificate">Certificate</TabsTrigger>
        </TabsList>

        <TabsContent value="inspection"><PestInspectionForm jobId={id!} /></TabsContent>
        <TabsContent value="treatment"><PestTreatmentForm jobId={id!} /></TabsContent>
        <TabsContent value="areas"><PestAreasManager jobId={id!} /></TabsContent>
        <TabsContent value="photos"><PestPhotosUploader jobId={id!} /></TabsContent>
        <TabsContent value="followups"><PestFollowupsManager jobId={id!} /></TabsContent>

        <TabsContent value="signature">
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold">Client signature</h3>
            {job.client_signature ? (
              <div>
                <img src={job.client_signature} alt="Client signature" className="border rounded bg-white max-h-32" />
                <p className="text-xs text-muted-foreground mt-1">Signed at {new Date(job.client_signed_at).toLocaleString()}</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Have the client sign below to acknowledge the treatment and safety briefing.</p>
                <canvas ref={sigRef}
                  className="w-full h-40 border rounded-md bg-white touch-none"
                  onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
                  onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clear}><RotateCcw className="h-4 w-4 mr-1" /> Clear</Button>
                  <Button size="sm" onClick={saveSignature} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save signature</Button>
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="certificate">
          <GeneratePestCertificateButton jobId={id!} onIssued={() => {
            setLastCert({ bookingId: null, clientId: job.client_id, clientName: job.client_name });
            setFeedbackOpen(true);
            load();
          }} />
        </TabsContent>
      </Tabs>

      {lastCert && (
        <FeedbackDialog
          open={feedbackOpen}
          onOpenChange={setFeedbackOpen}
          bookingId={lastCert.bookingId || undefined}
          clientId={lastCert.clientId || undefined}
          clientName={lastCert.clientName}
          agentName={profile?.full_name}
          serviceName={`Pest Control – ${job.pest_type || ''}`}
        />
      )}
    </div>
  );
}
