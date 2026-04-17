import { supabase } from '@/integrations/supabase/client';
import { saveDocumentRecord } from './documentSaver';
import { format } from 'date-fns';

interface AutoQuotationParams {
  clientName: string;
  clientPhone: string;
  clientLocation?: string;
  lineItems: { name: string; quantity?: number; unitPrice?: number; total: number }[];
  totalAmount: number;
  serviceDate?: Date;
  createdById: string;
  createdBy: string;
  createdByRole: string;
  bookingId?: string;
  clientId?: string;
  salespersonName?: string;
}

/**
 * Auto-creates a quotation record in the `quotations` table AND in the `documents`
 * registry as soon as a booking is created. The user can later download/share the
 * PDF from the Documents page or via the QuotationActions buttons on the booking form.
 */
export async function autoCreateQuotationForBooking(params: AutoQuotationParams) {
  const { data: numData } = await supabase.rpc('next_quotation_number' as any);
  const quotationNumber = (numData as string) || `CCS-QT-${Date.now()}`;
  const dateCreated = format(new Date(), 'PPP');
  const serviceDateStr = params.serviceDate ? format(params.serviceDate, 'PPP') : dateCreated;

  // Save quotation row
  const { data: q } = await supabase.from('quotations').insert({
    quotation_number: quotationNumber,
    client_name: params.clientName,
    client_phone: params.clientPhone,
    service_name: params.lineItems.map(i => i.name).join(', '),
    service_date: params.serviceDate ? format(params.serviceDate, 'yyyy-MM-dd') : null,
    price: params.totalAmount,
    created_by: params.createdById,
    created_by_name: params.salespersonName || params.createdBy,
    created_by_role: params.createdByRole,
    line_items: params.lineItems as any,
    salesperson_id: params.createdById,
    salesperson_name: params.salespersonName || params.createdBy,
    salesperson_role: params.createdByRole,
  } as any).select('id').single();

  // Save into documents registry
  await saveDocumentRecord({
    documentType: 'quotation',
    documentNumber: quotationNumber,
    dateCreated,
    createdBy: params.salespersonName || params.createdBy,
    createdByRole: params.createdByRole,
    clientName: params.clientName,
    clientPhone: params.clientPhone,
    clientLocation: params.clientLocation,
    lineItems: params.lineItems.map(i => ({
      name: i.name,
      quantity: i.quantity || 1,
      unitPrice: i.unitPrice || i.total,
      total: i.total,
    })),
    totalAmount: params.totalAmount,
    serviceDate: serviceDateStr,
    createdById: params.createdById,
    bookingId: params.bookingId,
    clientId: params.clientId,
    quotationId: (q as any)?.id,
    status: 'draft',
  });

  return quotationNumber;
}
