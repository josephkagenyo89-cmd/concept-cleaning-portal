import { supabase } from '@/integrations/supabase/client';
import { DocumentData, DocumentType } from './documentPdf';

/**
 * Auto-saves a document record to the documents table whenever a PDF is generated.
 * This creates a centralized registry of all system documents.
 */
export async function saveDocumentRecord(data: DocumentData & {
  createdById: string;
  bookingId?: string;
  invoiceId?: string;
  quotationId?: string;
  clientId?: string;
  status?: string;
}): Promise<string | null> {
  const { data: doc, error } = await supabase.from('documents').insert({
    document_type: data.documentType,
    document_number: data.documentNumber,
    client_name: data.clientName || data.staffName || null,
    client_phone: data.clientPhone || null,
    client_location: data.clientLocation || null,
    staff_name: data.staffName || null,
    department: data.department || null,
    payment_reason: data.paymentReason || null,
    service_name: data.lineItems.map(i => i.name).join(', '),
    amount: data.totalAmount,
    subtotal: data.subtotal ?? data.totalAmount + (Number(data.discountAmount) || 0),
    discount_amount: Number(data.discountAmount) || 0,
    discount_reason: data.discountReason || null,
    discount_type: data.discountType || null,
    discount_value: data.discountValue ?? null,
    discount_approval_status: data.discountStatus || 'not_required',
    unit_price: data.lineItems.length === 1 ? (data.lineItems[0].unitPrice || data.lineItems[0].total) : null,
    quantity: data.lineItems.length === 1 ? String(data.lineItems[0].quantity || 1) : String(data.lineItems.length),
    line_items: data.lineItems as any,
    payment_status: data.paymentStatus || null,
    description: [
      data.notes,
      Number(data.discountAmount) > 0
        ? `Discount: ${Number(data.discountAmount).toFixed(2)} (${data.discountReason || 'Reason not specified'})`
        : 'Discount: None applied',
    ].filter(Boolean).join('\n') || null,
    created_by: data.createdById,
    created_by_name: data.createdBy,
    created_by_role: data.createdByRole,
    salesperson_name: data.createdBy,
    booking_id: data.bookingId || null,
    invoice_id: data.invoiceId || null,
    quotation_id: data.quotationId || null,
    client_id: data.clientId || null,
    status: data.status || 'draft',
  } as any).select('id').single();

  if (error) {
    console.error('Failed to save document record:', error.message);
    return null;
  }
  return (doc as any)?.id || null;
}
