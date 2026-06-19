import jsPDF from 'jspdf';
import QRCode from 'qrcode';

/**
 * Document security & authenticity helpers.
 * Adds watermarks, company seal, gold certified seal, QR codes and
 * verification codes onto generated PDFs.
 *
 * All drawing routines are synchronous so they can be used inside the
 * existing sync PDF generators.
 */

const WATERMARKS: Record<string, string> = {
  quotation: 'OFFICIAL QUOTATION',
  invoice: 'APPROVED INVOICE',
  receipt: 'OFFICIAL RECEIPT',
  service_certificate: 'SERVICE COMPLETION CERTIFICATE',
  pest_certificate: 'CERTIFIED PEST MANAGEMENT SERVICE',
  pest_report: 'OFFICIAL PEST MANAGEMENT REPORT',
  booking_confirmation: 'BOOKING CONFIRMATION',
  job_card: 'OFFICIAL JOB CARD',
  fuel_voucher: 'OFFICIAL VOUCHER',
  salary_voucher: 'OFFICIAL VOUCHER',
  expense_voucher: 'OFFICIAL VOUCHER',
};

const VERIFICATION_PREFIX: Record<string, string> = {
  quotation: 'CCS-QUO',
  invoice: 'CCS-INV',
  receipt: 'CCS-RCP',
  service_certificate: 'CCS-SCC',
  pest_certificate: 'CCS-PST',
  pest_report: 'CCS-PSR',
  booking_confirmation: 'CCS-BKC',
  job_card: 'CCS-JBC',
  fuel_voucher: 'CCS-FVC',
  salary_voucher: 'CCS-SVC',
  expense_voucher: 'CCS-EVC',
};

export function getWatermarkText(documentType: string): string {
  return WATERMARKS[documentType] || 'OFFICIAL DOCUMENT';
}

/**
 * Deterministic verification code derived from the document number so the
 * same document always re-generates the same code (tamper-evident).
 */
export function getVerificationCode(documentType: string, documentNumber: string): string {
  const prefix = VERIFICATION_PREFIX[documentType] || 'CCS-DOC';
  let hash = 0;
  const seed = `${prefix}|${documentNumber}`;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const code = Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
  return `${prefix}-${code}`;
}

/** Try to set graphics state opacity; silently no-op if jsPDF build lacks GState. */
function withOpacity(doc: jsPDF, opacity: number, fn: () => void) {
  const anyDoc = doc as any;
  let prev: any = null;
  try {
    if (typeof anyDoc.GState === 'function' && typeof anyDoc.setGState === 'function') {
      prev = new anyDoc.GState({ opacity: 1 });
      anyDoc.setGState(new anyDoc.GState({ opacity }));
    }
  } catch { /* ignore */ }
  try {
    fn();
  } finally {
    try { if (prev) anyDoc.setGState(prev); } catch { /* ignore */ }
  }
}

/**
 * Diagonal watermark text spanning the page. Drawn first so all content sits
 * on top of it.
 */
export function drawDiagonalWatermark(doc: jsPDF, w: number, h: number, text: string) {
  withOpacity(doc, 0.07, () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(60);
    doc.setTextColor(20, 20, 20);
    doc.text(text, w / 2, h / 2, { angle: 45, align: 'center', baseline: 'middle' });
  });
}

/**
 * Circular company security seal — semi-transparent watermark in the body.
 */
export function drawCompanySeal(
  doc: jsPDF,
  cx: number,
  cy: number,
  options: { companyName?: string; year?: number; slogan?: string } = {},
) {
  const companyName = (options.companyName || 'Concept Cleaning Services').toUpperCase();
  const year = options.year ?? new Date().getFullYear();
  const slogan = options.slogan;

  withOpacity(doc, 0.08, () => {
    doc.setDrawColor(42, 157, 143);
    doc.setLineWidth(0.8);
    doc.circle(cx, cy, 32, 'S');
    doc.circle(cx, cy, 27, 'S');
    doc.setLineWidth(0.3);
    doc.circle(cx, cy, 22, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(42, 157, 143);
    doc.text(companyName, cx, cy - 6, { align: 'center' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('OFFICIAL DOCUMENT', cx, cy, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(String(year), cx, cy + 7, { align: 'center' });

    if (slogan) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'italic');
      doc.text(slogan, cx, cy + 13, { align: 'center' });
    }
  });
}

/**
 * Premium gold "CERTIFIED & VERIFIED" seal used on receipts and certificates.
 * Drawn opaque so it reads as an official emblem (not a watermark).
 */
export function drawGoldCertifiedSeal(doc: jsPDF, cx: number, cy: number, radius = 18) {
  const gold: [number, number, number] = [184, 134, 11];
  const goldLight: [number, number, number] = [212, 175, 55];
  const ink: [number, number, number] = [120, 80, 0];

  // Outer ring
  doc.setFillColor(...goldLight);
  doc.circle(cx, cy, radius, 'F');
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.circle(cx, cy, radius, 'S');

  // Inner disc
  doc.setFillColor(255, 248, 220);
  doc.circle(cx, cy, radius - 4, 'F');
  doc.setLineWidth(0.4);
  doc.setDrawColor(...gold);
  doc.circle(cx, cy, radius - 4, 'S');

  // Decorative star points (small triangles around edge)
  const points = 12;
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const x1 = cx + Math.cos(a) * (radius - 1);
    const y1 = cy + Math.sin(a) * (radius - 1);
    const x2 = cx + Math.cos(a) * (radius - 3);
    const y2 = cy + Math.sin(a) * (radius - 3);
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.6);
    doc.line(x1, y1, x2, y2);
  }

  // Text
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CERTIFIED', cx, cy - 2, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('&', cx, cy + 1.5, { align: 'center' });
  doc.setFontSize(7);
  doc.text('VERIFIED', cx, cy + 5, { align: 'center' });
}

/**
 * Draw a QR code as filled rectangles, fully synchronously, by rendering the
 * QR matrix from the `qrcode` library.
 */
export function drawQrCode(doc: jsPDF, x: number, y: number, size: number, text: string) {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const modules = qr.modules;
    const count: number = (modules as any).size;
    const data: Uint8Array = (modules as any).data;
    const cell = size / count;

    // White background for scannability
    doc.setFillColor(255, 255, 255);
    doc.rect(x - 0.5, y - 0.5, size + 1, size + 1, 'F');

    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (data[r * count + c]) {
          doc.rect(x + c * cell, y + r * cell, cell, cell, 'F');
        }
      }
    }
  } catch {
    // Fallback: simple box
    doc.setDrawColor(0, 0, 0);
    doc.rect(x, y, size, size, 'S');
  }
}

export interface VerificationPayload {
  companyName: string;
  documentType: string;
  documentNumber: string;
  clientName?: string;
  clientId?: string;
  issueDate: string;
  status: string;
  verificationCode: string;
}

export function buildVerificationPayload(p: VerificationPayload): string {
  return [
    `Company: ${p.companyName}`,
    `Type: ${p.documentType}`,
    `Number: ${p.documentNumber}`,
    p.clientName ? `Client: ${p.clientName}` : '',
    p.clientId ? `Client ID: ${p.clientId}` : '',
    `Issued: ${p.issueDate}`,
    `Status: ${p.status}`,
    `Verify: ${p.verificationCode}`,
  ].filter(Boolean).join('\n');
}
