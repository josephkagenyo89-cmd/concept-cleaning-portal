import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, ReceiptText, Award } from 'lucide-react';
import { formatKes } from '@/lib/marketplace';
import CustomerLoginPrompt from '@/components/marketplace/CustomerLoginPrompt';

export default function CustomerDocuments() {
  const { user, isCustomer } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isCustomer) { setLoading(false); return; }
    (async () => {
      const [inv, docs, certs] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('documents').select('*').order('created_at', { ascending: false }),
        supabase.from('service_certificates').select('*').order('created_at', { ascending: false }),
      ]);
      setInvoices(inv.data || []);
      setReceipts(docs.data || []);
      setCertificates(certs.data || []);
      setLoading(false);
    })();
  }, [user, isCustomer]);

  if (!isCustomer) return <CustomerLoginPrompt title="My documents" />;

  return (
    <div className="p-4">
      <h1 className="text-base font-bold">My documents</h1>
      <p className="mb-4 text-xs text-muted-foreground">Invoices, receipts and service certificates.</p>

      <Tabs defaultValue="invoices">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="certs">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-3 pt-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && invoices.length === 0 && <p className="text-sm text-muted-foreground">No invoices yet.</p>}
          {invoices.map((i) => (
            <Card key={i.id}><CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-market" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{i.invoice_number}</p>
                <p className="text-xs text-muted-foreground">{i.service} · {new Date(i.date).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-market">{formatKes(Number(i.amount))}</p>
                <Badge variant="secondary" className="capitalize">{i.payment_status}</Badge>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="receipts" className="space-y-3 pt-3">
          {!loading && receipts.length === 0 && <p className="text-sm text-muted-foreground">No receipts yet.</p>}
          {receipts.map((d) => (
            <Card key={d.id}><CardContent className="flex items-center gap-3 p-4">
              <ReceiptText className="h-5 w-5 text-market" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{d.document_number}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {String(d.document_type).replace('_', ' ')} · {new Date(d.created_at).toLocaleDateString()}
                </p>
              </div>
              <p className="text-sm font-bold text-market">{formatKes(Number(d.amount))}</p>
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="certs" className="space-y-3 pt-3">
          {!loading && certificates.length === 0 && <p className="text-sm text-muted-foreground">No certificates yet.</p>}
          {certificates.map((c) => (
            <Card key={c.id}><CardContent className="flex items-center gap-3 p-4">
              <Award className="h-5 w-5 text-market" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.certificate_number}</p>
                <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
              </div>
              <p className="text-sm font-bold text-market">{formatKes(Number(c.amount_paid))}</p>
            </CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
