import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, FileText, Download, Share2, Trash2, Filter } from 'lucide-react';
import { downloadDocumentPdf, shareDocumentWhatsApp, DocumentData, DocumentType } from '@/lib/documentPdf';
import { useAuth } from '@/contexts/AuthContext';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'fuel_voucher', label: 'Fuel Voucher' },
  { value: 'salary_voucher', label: 'Salary Voucher' },
  { value: 'expense_voucher', label: 'Expense Voucher' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
];

function toDocData(d: any): DocumentData {
  const lineItems = Array.isArray(d.line_items) && d.line_items.length > 0
    ? d.line_items.map((i: any) => ({
        name: i.name || i.serviceName || 'Item',
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || i.unit_price || i.total,
        total: i.total || i.unitPrice || 0,
      }))
    : [{
        name: d.service_name || 'Item',
        quantity: d.quantity || '1',
        unitPrice: d.unit_price ? Number(d.unit_price) : undefined,
        total: Number(d.amount),
      }];

  return {
    documentType: d.document_type as DocumentType,
    documentNumber: d.document_number,
    dateCreated: format(new Date(d.created_at), 'PPP'),
    createdBy: d.salesperson_name || d.created_by_name,
    createdByRole: d.created_by_role,
    clientName: d.client_name,
    clientPhone: d.client_phone,
    clientLocation: d.client_location,
    staffName: d.staff_name,
    department: d.department,
    paymentReason: d.payment_reason,
    lineItems: lineItems,
    totalAmount: Number(d.amount),
    paymentStatus: d.payment_status,
  };
}

export default function AdminDocuments() {
  const { isSuperAdmin } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    setDocuments((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return documents.filter(d => {
      if (typeFilter !== 'all' && d.document_type !== typeFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (dateFrom && d.created_at < dateFrom) return false;
      if (dateTo && d.created_at > dateTo + 'T23:59:59') return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (d.client_name || '').toLowerCase().includes(s)
        || (d.staff_name || '').toLowerCase().includes(s)
        || (d.document_number || '').toLowerCase().includes(s);
    });
  }, [documents, typeFilter, statusFilter, dateFrom, dateTo, search]);

  const handleDownload = (d: any) => downloadDocumentPdf(toDocData(d));
  const handleWhatsApp = (d: any) => shareDocumentWhatsApp(toDocData(d));

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Document deleted' });
      load();
    }
  };

  const typeLabel = (t: string) => TYPE_OPTIONS.find(o => o.value === t)?.label || t;

  const typeBadgeColor = (t: string) => {
    switch (t) {
      case 'quotation': return 'bg-blue-100 text-blue-800';
      case 'invoice': return 'bg-purple-100 text-purple-800';
      case 'receipt': return 'bg-green-100 text-green-800';
      case 'fuel_voucher': return 'bg-orange-100 text-orange-800';
      case 'salary_voucher': return 'bg-yellow-100 text-yellow-800';
      case 'expense_voucher': return 'bg-red-100 text-red-800';
      default: return '';
    }
  };

  const statusBadgeColor = (s: string) => {
    switch (s) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <Badge variant="outline" className="text-xs">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search ref # or client..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Document Type" /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="From" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="To" />
          </div>
        </CardContent>
      </Card>

      {/* Document List */}
      {loading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Loading documents...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No documents found</p>
          <p className="text-xs mt-1">Documents are automatically created when you generate quotations, invoices, receipts, or vouchers.</p>
        </CardContent></Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference #</TableHead>
                      <TableHead>Client / Staff</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date Created</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Badge className={`text-xs ${typeBadgeColor(d.document_type)}`}>{typeLabel(d.document_type)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{d.document_number}</TableCell>
                        <TableCell>{d.client_name || d.staff_name || '-'}</TableCell>
                        <TableCell className="font-semibold">Ksh {Number(d.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm">{format(new Date(d.created_at), 'dd MMM yyyy')}</TableCell>
                        <TableCell className="text-sm">{d.created_by_name}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs capitalize ${statusBadgeColor(d.status || 'draft')}`}>{d.status || 'draft'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" title="Download PDF" onClick={() => handleDownload(d)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            {(d.client_phone) && (
                              <ShareDocumentMenu document={toDocData(d)} iconOnly variant="ghost" size="icon" />
                            )}
                            {isSuperAdmin && (
                              <Button size="icon" variant="ghost" title="Delete" onClick={() => handleDelete(d.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(d => (
              <Card key={d.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="space-y-1">
                      <div className="flex gap-2">
                        <Badge className={`text-xs ${typeBadgeColor(d.document_type)}`}>{typeLabel(d.document_type)}</Badge>
                        <Badge className={`text-xs capitalize ${statusBadgeColor(d.status || 'draft')}`}>{d.status || 'draft'}</Badge>
                      </div>
                      <p className="font-semibold">{d.client_name || d.staff_name || '-'}</p>
                      <p className="text-xs font-mono text-muted-foreground">{d.document_number}</p>
                    </div>
                    <p className="font-bold text-lg">Ksh {Number(d.amount).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>{format(new Date(d.created_at), 'dd MMM yyyy')}</span>
                    <span>By: {d.created_by_name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleDownload(d)} className="flex-1">
                      <Download className="h-3 w-3 mr-1" />PDF
                    </Button>
                    {d.client_phone && (
                      <Button size="sm" variant="outline" onClick={() => handleWhatsApp(d)} className="text-green-600">
                        <Share2 className="h-3 w-3 mr-1" />WhatsApp
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(d.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
