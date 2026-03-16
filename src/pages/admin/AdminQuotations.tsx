import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, FileText, Trash2 } from 'lucide-react';
import { downloadQuotationPdf } from '@/lib/quotationPdf';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminQuotations() {
  const { isSuperAdmin } = useAuth();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const load = async () => {
    const { data } = await supabase.from('quotations' as any).select('*').order('created_at', { ascending: false });
    setQuotations((data as any[]) || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = quotations.filter(q => {
    if (!search) return true;
    const s = search.toLowerCase();
    return q.client_name?.toLowerCase().includes(s) || q.quotation_number?.toLowerCase().includes(s) || q.service_name?.toLowerCase().includes(s);
  });

  const handleDownload = (q: any) => {
    downloadQuotationPdf({
      quotationNumber: q.quotation_number,
      quotationDate: format(new Date(q.created_at), 'PPP'),
      clientName: q.client_name,
      clientPhone: q.client_phone,
      serviceName: q.service_name,
      serviceDate: q.service_date ? format(new Date(q.service_date), 'PPP') : 'N/A',
      price: Number(q.price),
    });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('quotations' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Quotation deleted' });
      load();
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Quotations</h1>

      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by client, number, service..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No quotations found</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => (
            <Card key={q.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="space-y-0.5">
                    <p className="font-semibold">{q.client_name}</p>
                    <p className="text-xs text-muted-foreground">{q.client_phone}</p>
                    <p className="text-xs text-muted-foreground">{q.service_name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(q.created_at), 'PPP')}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant="outline" className="text-xs">{q.quotation_number}</Badge>
                    <p className="font-bold">Ksh {Number(q.price).toLocaleString()}</p>
                    <Badge variant="secondary" className="text-xs">{q.created_by_role}</Badge>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(q)}>
                    <FileText className="h-3 w-3 mr-1" />Download PDF
                  </Button>
                  {isSuperAdmin && (
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(q.id)}>
                      <Trash2 className="h-3 w-3 mr-1" />Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
