import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CalendarClock, Loader2, ShieldCheck } from 'lucide-react';

interface Followup {
  id: string; pest_job_id: string; followup_type: string; scheduled_date: string; status: string; notes: string | null;
}
interface Cert {
  id: string; pest_job_id: string; client_name: string; warranty_expiry: string | null;
  free_revisit_eligible: boolean; certificate_number: string;
}

export default function AdminPestRevisits() {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: f }, { data: c }] = await Promise.all([
      (supabase as any).from('pest_followups').select('*').eq('status', 'scheduled').order('scheduled_date'),
      (supabase as any).from('pest_certificates').select('id, pest_job_id, client_name, warranty_expiry, free_revisit_eligible, certificate_number')
        .gte('warranty_expiry', today).order('warranty_expiry'),
    ]);
    setFollowups((f as Followup[]) || []);
    setCerts((c as Cert[]) || []);
    setLoading(false);
  })(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild><Link to="/admin/pest"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
        <h1 className="text-xl font-bold flex items-center gap-2"><CalendarClock className="h-5 w-5" /> Revisits</h1>
        <span />
      </div>

      {loading ? <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : <>
        <Card>
          <CardHeader><CardTitle className="text-base">Scheduled follow-ups</CardTitle></CardHeader>
          <CardContent>
            {followups.length === 0 ? <p className="text-sm text-muted-foreground">No scheduled follow-ups.</p> :
              <div className="space-y-2">
                {followups.map((f) => (
                  <Link key={f.id} to={`/admin/pest/${f.pest_job_id}`}
                    className="flex justify-between items-center rounded border p-3 text-sm hover:bg-muted/40">
                    <div>
                      <Badge variant="outline" className="capitalize mr-2">{f.followup_type}</Badge>
                      <span className="font-medium">{f.scheduled_date}</span>
                      {f.notes && <p className="text-xs text-muted-foreground mt-1">{f.notes}</p>}
                    </div>
                    <Badge variant="secondary">{f.status}</Badge>
                  </Link>
                ))}
              </div>
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Active warranties</CardTitle></CardHeader>
          <CardContent>
            {certs.length === 0 ? <p className="text-sm text-muted-foreground">No active warranties.</p> :
              <div className="space-y-2">
                {certs.map((c) => (
                  <Link key={c.id} to={`/admin/pest/${c.pest_job_id}`}
                    className="flex justify-between items-center rounded border p-3 text-sm hover:bg-muted/40">
                    <div>
                      <p className="font-medium">{c.client_name}</p>
                      <p className="text-xs text-muted-foreground">{c.certificate_number} · expires {c.warranty_expiry}</p>
                    </div>
                    {c.free_revisit_eligible && <Badge>Free revisit</Badge>}
                  </Link>
                ))}
              </div>
            }
          </CardContent>
        </Card>
      </>}
    </div>
  );
}
