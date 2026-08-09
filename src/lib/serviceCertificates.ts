import { supabase } from '@/integrations/supabase/client';
import { downloadDocumentPdf, DocumentData } from './documentPdf';
import { saveDocumentRecord } from './documentSaver';
import { format as fmtDate } from 'date-fns';

export interface CertificateRecord {
  id: string;
  certificate_number: string;
  booking_id: string;
  invoice_id: string | null;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  client_location: string | null;
  services: string | null;
  line_items: any[];
  amount_paid: number;
  mpesa_code: string;
  payment_date: string;
  invoice_number: string | null;
  client_signature: string;
  staff_signature: string;
  staff_signed_name: string | null;
  client_signed_at: string | null;
  staff_signed_at: string | null;
  signature_bypassed?: boolean;
  signature_bypass_reason?: string | null;
  signature_bypassed_by_name?: string | null;
  signature_bypassed_at?: string | null;
  document_reference: string | null;
  generated_by: string;
  generated_by_name: string | null;
  generated_by_role: string | null;
  date_created: string;
}

/** Builds the DocumentData payload from a stored certificate record. */
export function certificateToDocData(c: CertificateRecord): DocumentData {
  const items =
    Array.isArray(c.line_items) && c.line_items.length > 0
      ? c.line_items.map((i: any) => ({
          name: i.name,
          description: i.description || i.serviceCode || undefined,
          quantity: i.quantity || 1,
          unitPrice: i.unitPrice || i.total,
          total: i.total,
        }))
      : [{ name: c.services || 'Cleaning Service', quantity: 1, unitPrice: c.amount_paid, total: c.amount_paid }];

  return {
    documentType: 'service_certificate',
    documentNumber: c.certificate_number,
    dateCreated: fmtDate(new Date(c.date_created), 'PPP'),
    createdBy: c.generated_by_name || 'Admin',
    createdByRole: c.generated_by_role || 'admin',
    clientName: c.client_name,
    clientPhone: c.client_phone || undefined,
    clientLocation: c.client_location || undefined,
    lineItems: items,
    totalAmount: Number(c.amount_paid),
    paymentStatus: 'PAID',
    mpesaCode: c.mpesa_code,
    paymentDate: fmtDate(new Date(c.payment_date), 'PPP'),
    invoiceNumber: c.invoice_number || undefined,
    amountPaid: Number(c.amount_paid),
    signatures: {
      clientSignature: c.client_signature || undefined,
      clientName: c.client_name,
      clientSignedAt: c.client_signed_at || undefined,
      staffSignature: c.staff_signature,
      staffName: c.staff_signed_name || undefined,
      staffSignedAt: c.staff_signed_at || undefined,
    },
    notes:
      (c.signature_bypassed
        ? `Client signature waived by ${c.signature_bypassed_by_name || 'administrator'}${
            c.signature_bypass_reason ? ` — ${c.signature_bypass_reason}` : ''
          }. `
        : '') +
      'This certificate confirms that the cleaning service has been completed satisfactorily and payment has been received in full. Thank you for choosing Concept Cleaning Services. We appreciate your business.',
  };
}

export interface GenerateOptions {
  bookingId: string;
  generatedById: string;
  generatedByName: string;
  generatedByRole: string;
  /** Admin-controlled override: issue the certificate without the client signature. */
  bypassClientSignature?: boolean;
  bypassReason?: string;
}

export interface GenerateResult {
  ok: boolean;
  reason?: string;
  certificate?: CertificateRecord;
}

/**
 * Generate a Service Completion Certificate from booking data.
 * Booking is the single source of truth — we read signatures + payment fields
 * directly from it. If payment fields aren't on the booking yet, we fall back
 * to the linked paid invoice.
 *
 * Allowed only when:
 *   booking.status in ('completed','fully_confirmed')
 *   client_signature, staff_signature, mpesa_code all present
 */
export async function generateServiceCertificate(opts: GenerateOptions): Promise<GenerateResult> {
  // 1. Load booking
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', opts.bookingId)
    .maybeSingle();
  if (bErr || !booking) return { ok: false, reason: 'Booking not found.' };

  const b = booking as any;

  if (!['completed', 'fully_confirmed'].includes(b.status)) {
    return { ok: false, reason: 'Booking must be completed or fully confirmed before issuing a certificate.' };
  }
  const bypassed = !b.client_signature && !!opts.bypassClientSignature;
  if (!b.client_signature && !opts.bypassClientSignature) {
    return { ok: false, reason: 'Client signature is missing.' };
  }
  if (!b.staff_signature) return { ok: false, reason: 'Staff signature is missing.' };

  // 2. Resolve payment data — prefer booking, fall back to paid invoice
  let amountPaid = Number(b.amount_paid || 0);
  let mpesaCode: string | null = b.mpesa_code || null;
  let paymentDate: string | null = b.payment_date || null;
  let invoiceNumber: string | null = null;
  let invoiceId: string | null = null;

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, mpesa_code, payment_date, payment_status')
    .eq('booking_id', opts.bookingId)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (invoice) {
    invoiceId = (invoice as any).id;
    invoiceNumber = (invoice as any).invoice_number;
    if (!mpesaCode) mpesaCode = (invoice as any).mpesa_code;
    if (!paymentDate) paymentDate = (invoice as any).payment_date;
    if (!amountPaid) amountPaid = Number((invoice as any).amount || 0);
    if ((invoice as any).payment_status !== 'paid' && !mpesaCode) {
      return { ok: false, reason: 'Invoice must be marked PAID before issuing a certificate.' };
    }
  }

  if (!mpesaCode) return { ok: false, reason: 'M-Pesa transaction code is required (record payment first).' };
  if (!paymentDate) paymentDate = new Date().toISOString();

  // 3. Generate certificate number
  const { data: cNum } = await supabase.rpc('next_certificate_number' as any);
  const certificateNumber = (cNum as string) || `CCS-CERT-${Date.now()}`;

  const lineItems =
    Array.isArray(b.line_items) && b.line_items.length > 0
      ? b.line_items.map((i: any) => ({
          name: i.name,
          quantity: i.quantity || 1,
          unitPrice: i.unitPrice || i.total,
          total: i.total,
        }))
      : [{ name: 'Cleaning Service', quantity: 1, unitPrice: amountPaid || Number(b.price), total: amountPaid || Number(b.price) }];

  const services = lineItems.map((i: any) => i.name).join(', ');

  // 4. Insert certificate record (multiple per booking allowed — no overwrite)
  const insertPayload = {
    certificate_number: certificateNumber,
    booking_id: opts.bookingId,
    invoice_id: invoiceId,
    client_id: b.client_id,
    client_name: b.client_name,
    client_phone: b.client_phone,
    client_location: b.location,
    services,
    line_items: lineItems,
    amount_paid: amountPaid,
    mpesa_code: mpesaCode,
    payment_date: paymentDate,
    invoice_number: invoiceNumber,
    client_signature: b.client_signature || null,
    signature_bypassed: bypassed,
    signature_bypass_reason: bypassed ? (opts.bypassReason || 'Client signature waived by administrator') : null,
    signature_bypassed_by: bypassed ? opts.generatedById : null,
    signature_bypassed_by_name: bypassed ? opts.generatedByName : null,
    signature_bypassed_at: bypassed ? new Date().toISOString() : null,
    staff_signature: b.staff_signature,
    staff_signed_name: b.staff_signed_name,
    client_signed_at: b.client_signed_at,
    staff_signed_at: b.staff_signed_at,
    document_reference: certificateNumber,
    generated_by: opts.generatedById,
    generated_by_name: opts.generatedByName,
    generated_by_role: opts.generatedByRole,
  };

  const { data: cert, error: insertErr } = await (supabase as any)
    .from('service_certificates')
    .insert(insertPayload)
    .select('*')
    .single();
  if (insertErr) return { ok: false, reason: insertErr.message };

  const certRecord = cert as unknown as CertificateRecord;

  // 5. Mirror into the documents registry so it appears in Documents module too.
  await saveDocumentRecord({
    ...certificateToDocData(certRecord),
    createdById: opts.generatedById,
    bookingId: opts.bookingId,
    invoiceId: invoiceId || undefined,
    clientId: b.client_id || undefined,
    status: 'completed',
  });

  return { ok: true, certificate: certRecord };
}

/** Quick helper: download a certificate PDF from its record. */
export function downloadCertificate(c: CertificateRecord) {
  return downloadDocumentPdf(certificateToDocData(c));
}

/** Share a certificate via WhatsApp (downloads PDF + opens wa.me with a message). */
export function shareCertificateWhatsApp(c: CertificateRecord) {
  downloadDocumentPdf(certificateToDocData(c));
  let phone = (c.client_phone || '').replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
  if (!phone.startsWith('254')) phone = '254' + phone;
  const msg = encodeURIComponent(
    [
      `Hello ${c.client_name},`,
      ``,
      `Please find attached your Service Completion Certificate (${c.certificate_number}).`,
      ``,
      `Thank you for choosing Concept Cleaning Services. We appreciate your business.`,
      ``,
      `Reach us anytime: +254796563741`,
    ].join('\n')
  );
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
}
