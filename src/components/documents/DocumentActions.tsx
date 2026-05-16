import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { downloadDocumentPdf, shareDocumentWhatsApp, DocumentData, DocumentType } from '@/lib/documentPdf';
import { saveDocumentRecord } from '@/lib/documentSaver';
import { loadAllSettings } from '@/lib/settings';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import ShareDocumentMenu from './ShareDocumentMenu';

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
  clientId?: string;
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
  service_certificate: 'next_certificate_number',
  pest_certificate: 'next_pest_certificate_number',
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

    // Auto-save to documents table using centralized saver
    await saveDocumentRecord({
      ...docData,
      createdById: props.userId,
      bookingId: props.bookingId,
      invoiceId: props.invoiceId,
      clientId: props.clientId,
      status: props.paymentStatus === 'paid' ? 'paid' : 'draft',
    });

    return docData;
  };

  const handleDownload = async () => {
    setGenerating(true);
    const data = await buildDocData();
    if (data) {
      downloadDocumentPdf(data);
      toast({ title: `${data.documentNumber} generated & saved` });
    }
    setGenerating(false);
  };

  const handleShare = async (withReview = false) => {
    setGenerating(true);
    const data = await buildDocData();
    if (data) {
      let reviewUrl = '';
      if (withReview) {
        const s = await loadAllSettings();
        reviewUrl = s.integrations?.google_review_url || '';
        if (!reviewUrl) {
          toast({
            title: 'Google review link not set',
            description: 'Add it in Settings → Integrations. Sending without review link.',
          });
        }
      }
      shareDocumentWhatsApp(data, {
        mode: withReview ? 'document_with_review' : 'document_only',
        googleReviewUrl: reviewUrl,
      });
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
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => handleShare(false)} disabled={props.disabled || generating}
            className="text-[hsl(142,70%,45%)]">
            <Share2 className="h-4 w-4 mr-1" />
            Share to Client
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleShare(true)} disabled={props.disabled || generating}
            className="text-amber-600">
            <Share2 className="h-4 w-4 mr-1" />
            Share + Review Request
          </Button>
        </>
      )}
    </div>
  );
}
