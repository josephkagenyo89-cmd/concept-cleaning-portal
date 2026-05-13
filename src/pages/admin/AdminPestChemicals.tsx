import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, FlaskConical } from 'lucide-react';

interface Row {
  id: string; chemical_name: string; dosage: string | null; quantity: number; unit: string | null;
  used_on: string; technician_name: string | null; pest_job_id: string;
}

export default function AdminPestChemicals() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data } = await (supabase as any).from('pest_chemical_usage').select('*').order('used_on', { ascending: false }).limit(500);
    setRows((data as Row[]) || []);
    setLoading(false);
  })(); }, []);

  const filtered = rows.filter((r) => !search || r.chemical_name.toLowerCase().includes(search.toLowerCase()));
  const totals = filtered.reduce((acc: Record<string, { qty: number; unit: string }>, r) => {
    const key = r.chemical_name;
    acc[key] = acc[key] || { qty: 0, unit: r.unit || '' };
    acc[key].qty += Number(r.quantity || 0);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild><Link to="/admin/pest"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
        <h1 className="text-xl font-bold flex items-center gap-2"><FlaskConical className="h-5 w-5" /> Chemical Log</h1>
        <span />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totals by chemical</CardTitle>
          <Input placeholder="Search by chemical name..." value={search} onChange={(e) => setSearch(e.target.value)} className="mt-2" />
        </CardHeader>
        <CardContent>
          {Object.keys(totals).length === 0 ? <p className="text-sm text-muted-foreground">No usage recorded.</p> : (
            <div className="space-y-1">
              {Object.entries(totals).map(([name, t]) => (
                <div key={name} className="flex justify-between rounded border p-2 text-sm">
                  <span className="font-medium">{name}</span>
                  <span>{t.qty.toLocaleString()} {t.unit}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Usage records</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> :
            filtered.length === 0 ? <p className="text-sm text-muted-foreground">No records.</p> :
            <div className="space-y-1">
              {filtered.map((r) => (
                <Link key={r.id} to={`/admin/pest/${r.pest_job_id}`}
                  className="block rounded border p-3 text-sm hover:bg-muted/40">
                  <div className="flex justify-between">
                    <span className="font-medium">{r.chemical_name}</span>
                    <span>{r.quantity} {r.unit}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{r.dosage || '—'} · {r.used_on} · {r.technician_name || 'N/A'}</p>
                </Link>
              ))}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}
