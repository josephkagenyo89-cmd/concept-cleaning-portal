import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { downloadDocumentPdf, shareDocumentWhatsApp, DocumentData, DocumentType } from '@/lib/documentPdf';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface DocumentActionsProps {
  documentType: DocumentType;
  clientName?: string;
  clientPhone?: string;
  clientLocation?: string;
  staffName?: string;
  department?: string;
  paymentReason?: string;
  serviceName: string;
  serviceDate?: Date;
  lineItems: { name: string; description?: string; quantity?: string | number; unitPrice?: number; total: number }[];
  totalAmount: number;
  userId: string;
  userName: string;
  userRole: string;
  notes?: string;
  paymentStatus?: string;
  bookingId?: string;
  invoiceId?: string;
  disabled?: boolean;
  showShare?: boolean;
  numberRpcName?: string;
}

const DEFAULT_RPC: Record<DocumentType, string> = {
  quotation: 'next_quotation_number',
  invoice: 'next_invoice_number',
  receipt: 'next_receipt_number',
  fuel_voucher: 'next_fuel_voucher_number',
  salary_voucher: 'next_salary_voucher_number',
  expense_voucher: 'next_expense_voucher_number',
  booking_confirmation: 'next_quotation_number',
  job_card: 'next_quotation_number',
};

export default function DocumentActions(props: DocumentActionsProps) {
  const [generating, setGenerating] = useState(false);

  const buildDocData = async (): Promise<DocumentData | null> => {
    const rpcName = props.numberRpcName || DEFAULT_RPC[props.documentType];
    const { data: numData, error: numError } = await supabase.rpc(rpcName as any);
    if (numError || !numData) {
      toast({ title: 'Failed to generate document number', variant: 'destructive' });
      return null;
    }

    const docData: DocumentData = {
      documentType: props.documentType,
      documentNumber: numData as string,
      dateCreated: format(new Date(), 'PPP'),
      createdBy: props.userName,
      createdByRole: props.userRole,
      clientName: props.clientName,
      clientPhone: props.clientPhone,
      clientLocation: props.clientLocation,
      staffName: props.staffName,
      department: props.department,
      paymentReason: props.paymentReason,
      lineItems: props.lineItems,
      totalAmount: props.totalAmount,
      serviceDate: props.serviceDate ? format(props.serviceDate, 'PPP') : undefined,
      paymentStatus: props.paymentStatus,
      notes: props.notes,
    };

    // Save to documents table
    await supabase.from('documents' as any).insert({
      document_number: docData.documentNumber,
      document_type: props.documentType,
      client_name: props.clientName || null,
      staff_name: props.staffName || null,
      client_phone: props.clientPhone || null,
      client_location: props.clientLocation || null,
      department: props.department || null,
      payment_reason: props.paymentReason || null,
      service_name: props.serviceName,
      quantity: props.lineItems[0]?.quantity?.toString() || null,
      unit_price: props.lineItems[0]?.unitPrice || null,
      amount: props.totalAmount,
      description: props.notes || null,
      payment_status: props.paymentStatus || null,
      created_by: props.userId,
      created_by_name: props.userName,
      created_by_role: props.userRole,
      booking_id: props.bookingId || null,
      invoice_id: props.invoiceId || null,
    });

    return docData;
  };

  const handleDownload = async () => {
    setGenerating(true);
    const data = await buildDocData();
    if (data) {
      downloadDocumentPdf(data);
      toast({ title: `${data.documentNumber} generated` });
    }
    setGenerating(false);
  };

  const handleShare = async () => {
    setGenerating(true);
    const data = await buildDocData();
    if (data) {
      shareDocumentWhatsApp(data);
      toast({ title: 'Document generated & WhatsApp opened' });
    }
    setGenerating(false);
  };

  const showShare = props.showShare !== false && !!props.clientPhone;

  return (
    <div className="flex gap-2 flex-wrap">
      <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={props.disabled || generating}>
        <FileText className="h-4 w-4 mr-1" />
        {generating ? 'Generating...' : 'Download PDF'}
      </Button>
      {showShare && (
        <Button type="button" variant="outline" size="sm" onClick={handleShare} disabled={props.disabled || generating}
          className="text-[hsl(142,70%,45%)]">
          <Share2 className="h-4 w-4 mr-1" />
          Share to Client
        </Button>
      )}
    </div>
  );
}
