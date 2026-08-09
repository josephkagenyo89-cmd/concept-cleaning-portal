import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, ReceiptText, Award, Download, FileSignature } from 'lucide-react';
import { formatKes } from '@/lib/marketplace';
import CustomerLoginPrompt from '@/components/marketplace/CustomerLoginPrompt';
import { useSettings } from '@/hooks/useSettings';
import { toast } from '@/hooks/use-toast';
import {
  downloadCustomerCertificate, downloadCustomerDocument, downloadCustomerInvoice,
  downloadCustomerQuotation, primePdfSettings,
} from '@/lib/customerDownloads';

export default function CustomerDocuments() {
  const { user, isCustomer } = useAuth();
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const tab = ['invoices', 'receipts', 'certificates', 'quotations'].includes(params.get('tab') || '') ? (params.get('tab') as string) : 'invoices';
  const [invoices, setInvoices] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    if (!user || !isCustomer) { setLoading(false); return; }
    (async () => {
      const [inv, docs, certs, quotes] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('documents').select('*').order('created_at', { ascending: false }),
        supabase.from('service_certificates').select('*').order('created_at', { ascending: false }),
        supabase.from('quotations').select('*').order('created_at', { ascending: false }),
      ]);
      setInvoices(inv.data || []);
      setReceipts(docs.data || []);
      setCertificates(certs.data || []);
      setQuotations(quotes.data || []);
      setLoading(false);
    })();
  }, [user, isCustomer]);

  const download = (fn: () => void, label: string) => {
    try {
      primePdfSettings(settings);
      fn();
      toast({ title: `${label} downloaded` });
    } catch (e: any) {
      toast({ title: 'Download failed', description: e?.message, variant: 'destructive' });
    }
  };

  if (!isCustomer) return <CustomerLoginPrompt title="My documents" />;

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-base font-bold">My documents</h1>
      <p className="mb-4 text-xs text-muted-foreground">Download your quotations, invoices, receipts and certificates.</p>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="quotations">Quotes</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="space-y-3 pt-3">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && quotations.length === 0 && <p className="text-sm text-muted-foreground">No quotations yet.</p>}
          {quotations.map((q) => (
            <Card key={q.id}><CardContent className="flex items-center gap-3 p-4">
              <FileSignature className="h-5 w-5 text-market" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{q.quotation_number}</p>
                <p className="text-xs text-muted-foreground">{q.service_name} · {new Date(q.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-market">{formatKes(Number(q.price))}</p>
                <Button size="sm" variant="outline" className="mt-1 h-7 px-2 text-xs"
                  onClick={() => download(() => downloadCustomerQuotation(q), q.quotation_number)}>
                  <Download className="mr-1 h-3 w-3" /> PDF
                </Button>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>


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
                <Button size="sm" variant="outline" className="mt-1 h-7 w-full px-2 text-xs"
                  onClick={() => download(() => downloadCustomerInvoice(i), i.invoice_number)}>
                  <Download className="mr-1 h-3 w-3" /> PDF
                </Button>
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
              <div className="text-right">
                <p className="text-sm font-bold text-market">{formatKes(Number(d.amount))}</p>
                <Button size="sm" variant="outline" className="mt-1 h-7 px-2 text-xs"
                  onClick={() => download(() => downloadCustomerDocument(d), d.document_number)}>
                  <Download className="mr-1 h-3 w-3" /> PDF
                </Button>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>

        <TabsContent value="certificates" className="space-y-3 pt-3">
          {!loading && certificates.length === 0 && <p className="text-sm text-muted-foreground">No certificates yet.</p>}
          {certificates.map((c) => (
            <Card key={c.id}><CardContent className="flex items-center gap-3 p-4">
              <Award className="h-5 w-5 text-market" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.certificate_number}</p>
                <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-market">{formatKes(Number(c.amount_paid))}</p>
                <Button size="sm" variant="outline" className="mt-1 h-7 px-2 text-xs"
                  onClick={() => download(() => downloadCustomerCertificate(c), c.certificate_number)}>
                  <Download className="mr-1 h-3 w-3" /> PDF
                </Button>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>

      </Tabs>
    </div>
  );
}
