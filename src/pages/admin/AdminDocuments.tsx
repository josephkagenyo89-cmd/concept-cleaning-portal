import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, FileText, Trash2 } from 'lucide-react';
import { downloadDocumentPdf, DocumentData, DocumentType } from '@/lib/documentPdf';
import { useAuth } from '@/contexts/AuthContext';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'fuel_voucher', label: 'Fuel Voucher' },
  { value: 'salary_voucher', label: 'Salary Voucher' },
  { value: 'expense_voucher', label: 'Expense Voucher' },
  { value: 'booking_confirmation', label: 'Booking Confirmation' },
  { value: 'job_card', label: 'Job Card' },
];

export default function AdminDocuments() {
  const { isSuperAdmin } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const load = async () => {
    const { data } = await supabase.from('documents' as any).select('*').order('created_at', { ascending: false });
    setDocuments((data as any[]) || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = documents.filter(d => {
    if (typeFilter !== 'all' && d.document_type !== typeFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (d.client_name || '').toLowerCase().includes(s)
      || (d.staff_name || '').toLowerCase().includes(s)
      || d.document_number?.toLowerCase().includes(s)
      || (d.service_name || '').toLowerCase().includes(s);
  });

  const handleDownload = (d: any) => {
    const docData: DocumentData = {
      documentType: d.document_type as DocumentType,
      documentNumber: d.document_number,
      dateCreated: format(new Date(d.created_at), 'PPP'),
      createdBy: d.created_by_name,
      createdByRole: d.created_by_role,
      clientName: d.client_name,
      clientPhone: d.client_phone,
      clientLocation: d.client_location,
      staffName: d.staff_name,
      department: d.department,
      paymentReason: d.payment_reason,
      lineItems: [{
        name: d.service_name || 'Item',
        quantity: d.quantity || '1',
        unitPrice: d.unit_price ? Number(d.unit_price) : undefined,
        total: Number(d.amount),
      }],
      totalAmount: Number(d.amount),
      paymentStatus: d.payment_status,
    };
    downloadDocumentPdf(docData);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('documents' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Document deleted' });
      load();
    }
  };

  const typeLabel = (t: string) => TYPE_OPTIONS.find(o => o.value === t)?.label || t;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Documents</h1>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, number, service..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No documents found</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="space-y-0.5">
                    <p className="font-semibold">{d.client_name || d.staff_name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{d.service_name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(d.created_at), 'PPP')}</p>
                    <p className="text-xs text-muted-foreground">By: {d.created_by_name} ({d.created_by_role})</p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant="outline" className="text-xs">{d.document_number}</Badge>
                    <p className="font-bold">Ksh {Number(d.amount).toLocaleString()}</p>
                    <Badge variant="secondary" className="text-xs capitalize">{typeLabel(d.document_type)}</Badge>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownload(d)}>
                    <FileText className="h-3 w-3 mr-1" />Download PDF
                  </Button>
                  {isSuperAdmin && (
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(d.id)}>
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
