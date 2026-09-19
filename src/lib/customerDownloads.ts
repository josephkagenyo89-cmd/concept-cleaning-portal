import { format } from 'date-fns';
import {
  DocumentData,
  DocumentLineItem,
  DocumentType,
  downloadDocumentPdf,
  setPdfSettings,
} from '@/lib/documentPdf';
import { downloadQuotationPdf } from '@/lib/quotationPdf';
import {
  certificateToDocData,
  CertificateRecord,
} from '@/lib/serviceCertificates';
import { generateDocumentPdf } from '@/lib/documentPdf';
import { AllSettings } from '@/lib/settings';

const safeDate = (v?: string | null) => {
  if (!v) return format(new Date(), 'PPP');
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : format(d, 'PPP');
};

function toLineItems(
  raw: any,
  fallbackName: string,
  amount: number,
): DocumentLineItem[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((i: any) => ({
      name: i.service_name || i.name || fallbackName,
      description:
        i.description || i.serviceCode || i.notes || undefined,
      quantity: i.quantity ?? 1,
      unitPrice:
        Number(i.unit_price ?? i.unitPrice ?? i.total ?? amount) || 0,
      total: Number(i.total ?? amount) || 0,
    }));
  }

  return [
    {
      name: fallbackName,
      quantity: 1,
      unitPrice: amount,
      total: amount,
    },
  ];
}

/** Applies branding/settings so customer-side PDFs match ERP documents. */
export function primePdfSettings(settings: AllSettings) {
  setPdfSettings(settings);
}

export function downloadCustomerInvoice(inv: any) {
  const amount = Number(inv.amount) || 0;

  const data: DocumentData = {
    documentType: 'invoice',
    documentNumber: inv.invoice_number,
    dateCreated: safeDate(inv.date || inv.created_at),
    createdBy:
      inv.salesperson_name || 'Concept Cleaning Services',
    createdByRole: inv.salesperson_role || 'staff',
    clientName: inv.client_name,
    clientPhone: inv.client_phone,
    lineItems: toLineItems(
      inv.line_items,
      inv.service || 'Cleaning Service',
      amount,
    ),
    totalAmount: amount,
    subtotal:
      inv.subtotal != null ? Number(inv.subtotal) : undefined,
    discountAmount: Number(inv.discount_amount) || 0,
    discountReason: inv.discount_reason || undefined,
    paymentStatus: inv.payment_status,
    notes: inv.notes || undefined,
    salespersonName: inv.salesperson_name || undefined,
  };

  downloadDocumentPdf(data);
}

export function downloadCustomerDocument(doc: any) {
  const amount = Number(doc.amount) || 0;
  const type = String(
    doc.document_type || 'receipt',
  ) as DocumentType;

  const data: DocumentData = {
    documentType: type,
    documentNumber: doc.document_number,
    dateCreated: safeDate(doc.created_at),
    createdBy:
      doc.created_by_name || 'Concept Cleaning Services',
    createdByRole: doc.created_by_role || 'staff',
    clientName: doc.client_name || undefined,
    clientPhone: doc.client_phone || undefined,
    clientLocation: doc.client_location || undefined,
    lineItems: toLineItems(
      doc.line_items,
      doc.service_name || doc.description || 'Service',
      amount,
    ),
    totalAmount: amount,
    paymentStatus: doc.payment_status || undefined,
    notes: doc.description || undefined,
    salespersonName: doc.salesperson_name || undefined,
  };

  downloadDocumentPdf(data);
}

export function downloadCustomerQuotation(q: any) {
  downloadQuotationPdf({
    quotationNumber: q.quotation_number,
    quotationDate: safeDate(q.created_at),
    clientName: q.client_name,
    clientPhone: q.client_phone,
    serviceName: q.service_name,
    serviceDate: q.service_date
      ? safeDate(q.service_date)
      : '',
    price: Number(q.price) || 0,
    subtotal:
      q.subtotal != null ? Number(q.subtotal) : undefined,
    discountAmount: Number(q.discount_amount) || 0,
    discountReason: q.discount_reason || undefined,
    lineItems:
      Array.isArray(q.line_items) && q.line_items.length
        ? q.line_items.map((i: any) => ({
            name:
              i.service_name || i.name || q.service_name,
            quantity: i.quantity ?? 1,
            unitPrice:
              Number(
                i.unit_price ?? i.unitPrice ?? i.total,
              ) || 0,
            total: Number(i.total) || 0,
          }))
        : undefined,
    salespersonName: q.salesperson_name || undefined,
  });
}

export function downloadCustomerBooking(b: any) {
  const amount = Number(b.price) || 0;
  const bookingNumber = b.booking_code || b.id;

  const data: DocumentData = {
    documentType: 'booking_confirmation',
    documentNumber: bookingNumber,
    dateCreated: safeDate(b.created_at),

    // Customer booked directly online, so salesperson is Online.
    createdBy: 'Online',
    createdByRole: 'online',

    clientName: b.client_name,
    clientId: b.client_id,
    clientPhone: b.client_phone,
    serviceLocation: b.location,

    lineItems: toLineItems(
      b.line_items,
      b.services?.name ||
        b.service_name ||
        'Cleaning Service',
      amount,
    ),

    totalAmount: amount,
    subtotal:
      b.subtotal != null ? Number(b.subtotal) : undefined,
    discountAmount: Number(b.discount_amount) || 0,
    discountType: b.discount_type || undefined,
    discountValue:
      b.discount_value != null
        ? Number(b.discount_value)
        : undefined,
    discountReason: b.discount_reason || undefined,
    discountStatus:
      b.discount_approval_status || 'not_required',

    serviceDate: b.service_date
      ? safeDate(b.service_date)
      : '',

    salespersonName: 'Online',

    notes:
      [
        b.status
          ? `Booking Status: ${String(b.status).replace(
              /_/g,
              ' ',
            )}`
          : '',
        b.notes || '',
      ]
        .filter(Boolean)
        .join('\n') || undefined,
  };

  downloadDocumentPdf(data);
}

export function downloadCustomerCertificate(cert: any) {
  const data = certificateToDocData(
    cert as CertificateRecord,
  );
  const pdf = generateDocumentPdf(data);
  pdf.save(
    `Certificate-${cert.certificate_number}.pdf`,
  );
}