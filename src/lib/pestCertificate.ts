import { supabase } from '@/integrations/supabase/client';
import { downloadDocumentPdf, DocumentData } from './documentPdf';
import { saveDocumentRecord } from './documentSaver';
import { format as fmtDate, addDays } from 'date-fns';

export interface PestCertificateRecord {
  id: string;
  certificate_number: string;
  pest_job_id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  client_location: string | null;
  treatment_summary: string | null;
  chemicals_summary: string | null;
  safety_recommendations: string | null;
  warranty_days: number;
  warranty_expiry: string | null;
  free_revisit_eligible: boolean;
  amount_paid: number;
  mpesa_code: string | null;
  payment_date: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  client_signature: string | null;
  client_signed_at: string | null;
  staff_signature: string | null;
  staff_signed_name: string | null;
  staff_signed_at: string | null;
  generated_by: string;
  generated_by_name: string | null;
  generated_by_role: string | null;
  created_at: string;
}

export function pestCertToDocData(c: PestCertificateRecord): DocumentData {
  const notes = [
    c.treatment_summary && `Treatment Performed: ${c.treatment_summary}`,
    c.chemicals_summary && `Chemicals Used: ${c.chemicals_summary}`,
    c.safety_recommendations && `Safety Recommendations: ${c.safety_recommendations}`,
    c.warranty_days > 0 &&
      `Warranty: ${c.warranty_days} days${c.warranty_expiry ? ` (valid until ${fmtDate(new Date(c.warranty_expiry), 'PPP')})` : ''}${c.free_revisit_eligible ? ' — Free revisit eligible.' : ''}`,
    'Thank you for choosing Concept Cleaning Services. We appreciate your business.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    documentType: 'pest_certificate',
    documentNumber: c.certificate_number,
    dateCreated: fmtDate(new Date(c.created_at), 'PPP'),
    createdBy: c.generated_by_name || 'Admin',
    createdByRole: c.generated_by_role || 'admin',
    clientName: c.client_name,
    clientPhone: c.client_phone || undefined,
    clientLocation: c.client_location || undefined,
    lineItems: [
      {
        name: c.treatment_summary || 'Pest Control Treatment',
        quantity: 1,
        unitPrice: Number(c.amount_paid),
        total: Number(c.amount_paid),
      },
    ],
    totalAmount: Number(c.amount_paid),
    paymentStatus: 'PAID',
    mpesaCode: c.mpesa_code || undefined,
    paymentDate: c.payment_date ? fmtDate(new Date(c.payment_date), 'PPP') : undefined,
    invoiceNumber: c.invoice_number || undefined,
    amountPaid: Number(c.amount_paid),
    signatures: {
      clientSignature: c.client_signature || undefined,
      clientName: c.client_name,
      clientSignedAt: c.client_signed_at || undefined,
      staffSignature: c.staff_signature || undefined,
      staffName: c.staff_signed_name || undefined,
      staffSignedAt: c.staff_signed_at || undefined,
    },
    notes,
  };
}

export interface GeneratePestOptions {
  pestJobId: string;
  warrantyDays: number;
  freeRevisitEligible: boolean;
  safetyRecommendations: string;
  generatedById: string;
  generatedByName: string;
  generatedByRole: string;
  staffSignature?: string;
  staffSignedName?: string;
}

export interface GeneratePestResult {
  ok: boolean;
  reason?: string;
  certificate?: PestCertificateRecord;
}

export async function generatePestCertificate(opts: GeneratePestOptions): Promise<GeneratePestResult> {
  const { data: job } = await (supabase as any)
    .from('pest_jobs')
    .select('*')
    .eq('id', opts.pestJobId)
    .maybeSingle();
  if (!job) return { ok: false, reason: 'Pest job not found.' };

  if (!job.client_signature) return { ok: false, reason: 'Client signature is required.' };

  // Resolve linked invoice (optional but required for PAID gate)
  let invoiceId = job.invoice_id as string | null;
  let invoiceNumber: string | null = null;
  let mpesaCode: string | null = null;
  let paymentDate: string | null = null;
  let amountPaid = Number(job.price || 0);

  const { data: invoice } = await (supabase as any)
    .from('invoices')
    .select('id, invoice_number, amount, mpesa_code, payment_date, payment_status')
    .eq('id', invoiceId || '00000000-0000-0000-0000-000000000000')
    .maybeSingle();

  if (invoice) {
    if (invoice.payment_status !== 'paid') {
      return { ok: false, reason: 'Invoice must be marked PAID before issuing the pest certificate.' };
    }
    invoiceNumber = invoice.invoice_number;
    mpesaCode = invoice.mpesa_code;
    paymentDate = invoice.payment_date;
    amountPaid = Number(invoice.amount || amountPaid);
  } else if (!invoiceId) {
    return { ok: false, reason: 'Link a paid invoice to this job before issuing the certificate.' };
  }

  if (!mpesaCode) return { ok: false, reason: 'M-Pesa transaction code is required (record payment first).' };

  // Build summaries
  const { data: treatments } = await (supabase as any)
    .from('pest_treatments')
    .select('treatment_method, equipment_used, ppe_used')
    .eq('pest_job_id', opts.pestJobId);
  const treatmentSummary = (treatments || [])
    .map((t: any) => [t.treatment_method, t.equipment_used].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('; ') || `${job.pest_type || 'Pest'} treatment`;

  const { data: chemicals } = await (supabase as any)
    .from('pest_chemical_usage')
    .select('chemical_name, dosage, quantity, unit')
    .eq('pest_job_id', opts.pestJobId);
  const chemicalsSummary = (chemicals || [])
    .map((c: any) => `${c.chemical_name}${c.dosage ? ` (${c.dosage})` : ''}${c.quantity ? ` × ${c.quantity}${c.unit || ''}` : ''}`)
    .join(', ') || 'As per safety data sheets';

  // Generate cert number
  const { data: cNum } = await (supabase as any).rpc('next_pest_certificate_number');
  const certificateNumber = (cNum as string) || `CCS-PEST-${Date.now()}`;

  const warrantyExpiry = opts.warrantyDays > 0 ? fmtDate(addDays(new Date(), opts.warrantyDays), 'yyyy-MM-dd') : null;

  const insertPayload = {
    certificate_number: certificateNumber,
    pest_job_id: opts.pestJobId,
    client_id: job.client_id,
    client_name: job.client_name,
    client_phone: job.client_phone,
    client_location: job.client_location,
    treatment_summary: treatmentSummary,
    chemicals_summary: chemicalsSummary,
    safety_recommendations: opts.safetyRecommendations,
    warranty_days: opts.warrantyDays,
    warranty_expiry: warrantyExpiry,
    free_revisit_eligible: opts.freeRevisitEligible,
    amount_paid: amountPaid,
    mpesa_code: mpesaCode,
    payment_date: paymentDate,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    client_signature: job.client_signature,
    client_signed_at: job.client_signed_at,
    staff_signature: opts.staffSignature || null,
    staff_signed_name: opts.staffSignedName || opts.generatedByName,
    staff_signed_at: new Date().toISOString(),
    generated_by: opts.generatedById,
    generated_by_name: opts.generatedByName,
    generated_by_role: opts.generatedByRole,
  };

  const { data: cert, error } = await (supabase as any)
    .from('pest_certificates')
    .insert(insertPayload)
    .select('*')
    .single();
  if (error) return { ok: false, reason: error.message };

  const record = cert as PestCertificateRecord;

  await saveDocumentRecord({
    ...pestCertToDocData(record),
    createdById: opts.generatedById,
    invoiceId: invoiceId || undefined,
    clientId: job.client_id || undefined,
    status: 'completed',
  });

  // Mark job completed
  await (supabase as any).from('pest_jobs').update({ status: 'completed' }).eq('id', opts.pestJobId);

  return { ok: true, certificate: record };
}

export function downloadPestCertificate(c: PestCertificateRecord) {
  return downloadDocumentPdf(pestCertToDocData(c));
}
