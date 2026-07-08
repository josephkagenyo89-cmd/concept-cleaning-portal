import jsPDF from 'jspdf';
import { DEFAULT_SETTINGS, type AllSettings } from '@/lib/settings';
import {
  getWatermarkText,
  getVerificationCode,
  drawDiagonalWatermark,
  drawCompanySeal,
  drawGoldCertifiedSeal,
  drawQrCode,
  buildVerificationPayload,
} from '@/lib/documentSecurity';

// Settings snapshot used during PDF rendering. Updated by setPdfSettings().
let pdfSettings: AllSettings = DEFAULT_SETTINGS;
export function setPdfSettings(s: AllSettings) { pdfSettings = s; }

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export type DocumentType =
  | 'quotation'
  | 'invoice'
  | 'receipt'
  | 'fuel_voucher'
  | 'salary_voucher'
  | 'expense_voucher'
  | 'booking_confirmation'
  | 'job_card'
  | 'service_certificate'
  | 'pest_certificate';

const DOC_TITLES: Record<DocumentType, string> = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  receipt: 'Receipt',
  fuel_voucher: 'Fuel Voucher',
  salary_voucher: 'Salary Voucher',
  expense_voucher: 'Expense Voucher',
  booking_confirmation: 'Booking Confirmation',
  job_card: 'Job Card',
  service_certificate: 'Service Completion Certificate',
  pest_certificate: 'Pest Control Certificate',
};

const FILE_PREFIXES: Record<DocumentType, string> = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  receipt: 'Receipt',
  fuel_voucher: 'FuelVoucher',
  salary_voucher: 'SalaryVoucher',
  expense_voucher: 'ExpenseVoucher',
  booking_confirmation: 'BookingConfirmation',
  job_card: 'JobCard',
  service_certificate: 'ServiceCertificate',
  pest_certificate: 'PestCertificate',
};

export interface DocumentLineItem {
  name: string;
  description?: string;
  quantity?: string | number;
  unitPrice?: number;
  discount?: number;
  total: number;
}

export interface SignatureData {
  clientSignature?: string;
  clientName?: string;
  clientSignedAt?: string;
  staffSignature?: string;
  staffName?: string;
  staffSignedAt?: string;
}

export interface DocumentData {
  documentType: DocumentType;
  documentNumber: string;
  dateCreated: string;
  createdBy: string;
  createdByRole: string;
  clientName?: string;
  clientId?: string;
  companyName?: string;
  contactPerson?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientLocation?: string;
  serviceLocation?: string;
  staffName?: string;
  department?: string;
  paymentReason?: string;
  lineItems: DocumentLineItem[];
  totalAmount: number;
  subtotal?: number;
  discountAmount?: number;
  discountType?: 'percent' | 'fixed' | null | '';
  discountValue?: number;
  discountReason?: string;
  discountStatus?: 'pending' | 'approved' | 'rejected' | 'not_required';
  paymentStatus?: string;
  notes?: string;
  serviceDate?: string;
  validUntil?: string;
  preparedBy?: string;
  salespersonName?: string;
  signatures?: SignatureData;
  // Payment / linkage fields used by receipts and certificates
  mpesaCode?: string;
  paymentDate?: string;
  invoiceNumber?: string;
  amountPaid?: number;
}

// Brand palette
const NAVY: [number, number, number] = [11, 61, 145];      // #0B3D91
const EMERALD: [number, number, number] = [0, 166, 81];    // #00A651
const GOLD: [number, number, number] = [201, 162, 39];     // #C9A227
const INK: [number, number, number] = [51, 51, 51];        // #333333
const MUTED: [number, number, number] = [110, 118, 129];
const SOFT_BG: [number, number, number] = [245, 247, 251];
const ZEBRA: [number, number, number] = [249, 250, 252];
const WHITE: [number, number, number] = [255, 255, 255];
const BORDER: [number, number, number] = [220, 225, 232];

const MARGIN_X = 16;

function primary(): [number, number, number] {
  const c = pdfSettings.document.primary_color;
  if (c && c.toLowerCase() !== '#2a9d8f') return hexToRgb(c);
  return NAVY;
}

function fmt(n: number): string {
  return n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- Number to words (English, KES) ----------
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function threeDigitWords(n: number): string {
  let s = '';
  if (n >= 100) { s += ONES[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n) s += ' '; }
  if (n >= 20) { s += TENS[Math.floor(n / 10)]; n %= 10; if (n) s += '-' + ONES[n]; }
  else if (n > 0) { s += ONES[n]; }
  return s;
}

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  const parts: string[] = [];
  const scales = ['', 'Thousand', 'Million', 'Billion'];
  let i = 0;
  let n = Math.floor(num);
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(threeDigitWords(chunk) + (scales[i] ? ' ' + scales[i] : ''));
    n = Math.floor(n / 1000);
    i++;
  }
  return parts.join(' ');
}

function amountInWords(amount: number, currency = 'Kenya Shillings'): string {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100);
  let s = `${currency} ${numberToWords(whole)}`;
  if (cents > 0) s += ` and ${numberToWords(cents)} Cents`;
  return s + ' Only';
}

// ---------- Header (minimalist, white background) ----------
function drawHeader(doc: jsPDF, w: number, data: DocumentData): number {
  const brand = primary();
  const g = pdfSettings.general;

  // Soft brand corner wash (very subtle) — echoes reference top-left tint
  doc.setFillColor(235, 244, 241);
  doc.triangle(0, 0, 90, 0, 0, 36, 'F');

  // Logo top-left
  const logo = g.logo_url;
  const logoSize = 22;
  const logoX = MARGIN_X;
  const logoY = 12;
  if (logo) {
    try {
      const ext = logo.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      doc.addImage(logo, ext, logoX, logoY, logoSize, logoSize);
    } catch { /* ignore */ }
  } else {
    doc.setDrawColor(...brand);
    doc.setLineWidth(0.6);
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'S');
    doc.setTextColor(...brand);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CCS', logoX + logoSize / 2, logoY + logoSize / 2 + 3.5, { align: 'center' });
  }

  // Company name beside logo
  const cx = logoX + logoSize + 6;
  doc.setTextColor(...brand);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text((g.company_name || 'Concept Cleaning Services').toUpperCase(), cx, logoY + 8);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('Spotless Spaces. Healthier Living.', cx, logoY + 13);

  // Right-side company contact block
  const rx = w - MARGIN_X;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...brand);
  doc.text((g.company_name || 'Concept Cleaning Services').toUpperCase(), rx, logoY + 2, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  const contactLines: string[] = [];
  if (g.address) contactLines.push(g.address);
  if (g.phone) contactLines.push(g.phone);
  if (g.email) contactLines.push(g.email);
  if (g.website) contactLines.push(g.website);
  contactLines.forEach((l, i) => doc.text(l, rx, logoY + 8 + i * 4, { align: 'right' }));

  // Divider hairline
  let y = Math.max(logoY + logoSize, logoY + 8 + contactLines.length * 4) + 6;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, y, w - MARGIN_X, y);
  y += 8;

  // Bill To (left) + Document title (right)
  const isStaff = data.documentType.includes('voucher');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...EMERALD);
  doc.text(isStaff ? 'PAY TO' : 'BILL TO', MARGIN_X, y);

  const billLines: string[] = [];
  if (isStaff) {
    if (data.staffName) billLines.push(data.staffName.toUpperCase());
    if (data.department) billLines.push(data.department);
    if (data.paymentReason) billLines.push(data.paymentReason);
  } else {
    if (data.clientName) billLines.push(data.clientName.toUpperCase());
    if (data.contactPerson && data.contactPerson !== data.clientName) billLines.push(data.contactPerson);
    if (data.companyName) billLines.push(data.companyName);
    if (data.clientPhone) billLines.push(data.clientPhone);
    if (data.clientEmail) billLines.push(data.clientEmail);
    if (data.clientLocation) billLines.push(data.clientLocation);
    if (data.clientId) billLines.push(`Client ID: ${data.clientId}`);
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  billLines.slice(0, 5).forEach((l, i) => {
    if (i === 0) { doc.setFont('helvetica', 'bold'); doc.setFontSize(10); }
    else { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...INK); }
    doc.text(l, MARGIN_X, y + 5 + i * 4.2);
  });

  // Right: document title
  const title = DOC_TITLES[data.documentType];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...brand);
  doc.text(`${title} # ${data.documentNumber}`, w - MARGIN_X, y + 6, { align: 'right' });

  const bottom = y + Math.max(24, 5 + Math.min(billLines.length, 5) * 4.2 + 4);
  return bottom + 4;
}

// ---------- Meta strip (salesperson etc) ----------
function drawMetaStrip(doc: jsPDF, w: number, y: number, data: DocumentData): number {
  const sales = data.salespersonName || data.createdBy;
  const h = 10;
  doc.setFillColor(...SOFT_BG);
  doc.rect(MARGIN_X, y, w - MARGIN_X * 2, h, 'F');
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.rect(MARGIN_X, y, w - MARGIN_X * 2, h, 'S');

  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');

  const cells: [string, string][] = [
    ['Salesperson', sales || '-'],
    ['Reference', data.documentNumber],
    ['Service Date', data.serviceDate || '-'],
  ];
  const colW = (w - MARGIN_X * 2) / cells.length;
  cells.forEach(([label, value], i) => {
    const cx = MARGIN_X + colW * i + 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), cx, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text(value, cx, y + 8.2);
    if (i > 0) {
      doc.setDrawColor(...BORDER);
      doc.line(MARGIN_X + colW * i, y + 1.5, MARGIN_X + colW * i, y + h - 1.5);
    }
  });

  return y + h + 6;
}

// ---------- Client card ----------
function drawClientCard(doc: jsPDF, w: number, y: number, data: DocumentData): number {
  const isStaff = data.documentType.includes('voucher');
  const brand = primary();

  // Title bar
  doc.setFillColor(...brand);
  doc.rect(MARGIN_X, y, w - MARGIN_X * 2, 6, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(isStaff ? 'RECIPIENT DETAILS' : 'CLIENT DETAILS', MARGIN_X + 3, y + 4.2);

  y += 6;

  // Body
  const rows: [string, string | undefined][] = isStaff
    ? [
        ['Name', data.staffName],
        ['Department', data.department],
        ['Reason', data.paymentReason],
      ]
    : [
        ['Client Name', data.clientName],
        ['Client ID', data.clientId],
        ['Company', data.companyName],
        ['Contact Person', data.contactPerson || data.clientName],
        ['Phone', data.clientPhone],
        ['Email', data.clientEmail],
        ['Address', data.clientLocation],
        ['Service Location', data.serviceLocation || data.clientLocation],
      ];
  const shown = rows.filter(r => r[1]);
  const cols = 2;
  const rowH = 8;
  const rowCount = Math.ceil(shown.length / cols);
  const bodyH = rowCount * rowH + 4;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.rect(MARGIN_X, y, w - MARGIN_X * 2, bodyH, 'FD');

  const colW = (w - MARGIN_X * 2) / cols;
  shown.forEach((r, i) => {
    const c = i % cols;
    const rIdx = Math.floor(i / cols);
    const x = MARGIN_X + colW * c + 4;
    const ry = y + 3 + rIdx * rowH;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(r[0].toUpperCase(), x, ry + 2.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    const val = doc.splitTextToSize(r[1] || '-', colW - 8);
    doc.text(val[0], x, ry + 6.5);
  });

  return y + bodyH + 6;
}

// ---------- Services table ----------
function drawTable(doc: jsPDF, data: DocumentData, y: number, w: number): number {
  const brand = primary();
  const tableW = w - MARGIN_X * 2;
  const isVoucher = data.documentType.includes('voucher');

  let cols: { label: string; wPct: number; align: 'left' | 'right' }[];
  if (isVoucher) {
    cols = [
      { label: 'DESCRIPTION', wPct: 0.55, align: 'left' },
      { label: 'DETAILS', wPct: 0.25, align: 'left' },
      { label: 'AMOUNT', wPct: 0.20, align: 'right' },
    ];
  } else {
    cols = [
      { label: '#', wPct: 0.05, align: 'left' },
      { label: 'SERVICE', wPct: 0.24, align: 'left' },
      { label: 'DESCRIPTION', wPct: 0.28, align: 'left' },
      { label: 'QTY', wPct: 0.08, align: 'right' },
      { label: 'UNIT PRICE', wPct: 0.13, align: 'right' },
      { label: 'DISCOUNT', wPct: 0.10, align: 'right' },
      { label: 'TOTAL', wPct: 0.12, align: 'right' },
    ];
  }

  // Precompute x positions
  let acc = MARGIN_X;
  const positioned = cols.map(c => {
    const cw = tableW * c.wPct;
    const rec = { ...c, x: acc, w: cw };
    acc += cw;
    return rec;
  });

  const headerH = 8;
  doc.setFillColor(...brand);
  doc.rect(MARGIN_X, y, tableW, headerH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  positioned.forEach(col => {
    const tx = col.align === 'right' ? col.x + col.w - 3 : col.x + 3;
    doc.text(col.label, tx, y + 5.4, { align: col.align === 'right' ? 'right' : 'left' });
  });
  y += headerH;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  const cur = pdfSettings.system.currency || 'Ksh';
  const startY = y;

  data.lineItems.forEach((item, idx) => {
    const descLines = doc.splitTextToSize(item.description || '', (positioned[isVoucher ? 1 : 2].w) - 6);
    const nameLines = doc.splitTextToSize(item.name || '', (positioned[isVoucher ? 0 : 1].w) - 6);
    const lineCount = Math.max(nameLines.length, descLines.length, 1);
    const rowH = Math.max(9, lineCount * 4.4 + 3);

    // Zebra
    if (idx % 2 === 1) {
      doc.setFillColor(...ZEBRA);
      doc.rect(MARGIN_X, y, tableW, rowH, 'F');
    }
    // Row separator
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.15);
    doc.line(MARGIN_X, y + rowH, MARGIN_X + tableW, y + rowH);

    if (isVoucher) {
      doc.setTextColor(...INK);
      doc.text(nameLines, positioned[0].x + 3, y + 5.5);
      doc.text(item.description || '', positioned[1].x + 3, y + 5.5);
      doc.text(`${fmt(item.total)}`, positioned[2].x + positioned[2].w - 3, y + 5.5, { align: 'right' });
    } else {
      doc.setTextColor(...INK);
      doc.setFont('helvetica', 'normal');
      doc.text(String(idx + 1), positioned[0].x + 3, y + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.text(nameLines, positioned[1].x + 3, y + 5.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      doc.text(descLines, positioned[2].x + 3, y + 5.5);
      doc.setTextColor(...INK);
      const qty = item.quantity !== undefined && item.quantity !== '' ? String(item.quantity) : '1';
      doc.text(qty, positioned[3].x + positioned[3].w - 3, y + 5.5, { align: 'right' });
      doc.text(item.unitPrice !== undefined ? fmt(item.unitPrice) : '-', positioned[4].x + positioned[4].w - 3, y + 5.5, { align: 'right' });
      const disc = Number(item.discount) || 0;
      doc.text(disc > 0 ? fmt(disc) : '—', positioned[5].x + positioned[5].w - 3, y + 5.5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(fmt(item.total), positioned[6].x + positioned[6].w - 3, y + 5.5, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    y += rowH;
  });

  // Outer border
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN_X, startY - headerH, tableW, y - (startY - headerH), 'S');

  return y + 6;
}

// ---------- Price summary ----------
function drawSummary(doc: jsPDF, w: number, y: number, data: DocumentData): number {
  const brand = primary();
  const cur = pdfSettings.system.currency || 'Ksh';
  const tableW = w - MARGIN_X * 2;
  const boxW = tableW * 0.45;
  const boxX = MARGIN_X + tableW - boxW;
  const labelX = boxX + 4;
  const valueX = boxX + boxW - 4;

  const discountAmount = Math.max(0, Number(data.discountAmount) || 0);
  const subtotal = discountAmount > 0
    ? (Number(data.subtotal) || (data.totalAmount + discountAmount))
    : data.totalAmount;
  const isPending = data.discountStatus === 'pending';
  const showDiscount = discountAmount > 0 && !isPending;
  const grandTotal = showDiscount ? subtotal - discountAmount : subtotal;

  const rowH = 8;
  const rows: { label: string; value: string; isTotal?: boolean; pending?: boolean }[] = [
    { label: 'Subtotal', value: `${cur} ${fmt(subtotal)}` },
  ];
  if (discountAmount > 0) {
    if (isPending) {
      rows.push({ label: 'Discount', value: 'Awaiting Approval', pending: true });
    } else {
      const typeLabel = data.discountType === 'percent'
        ? `${Number(data.discountValue) || 0}%`
        : 'Fixed';
      rows.push({ label: `Discount (${typeLabel})`, value: `- ${cur} ${fmt(discountAmount)}` });
    }
  }
  rows.push({ label: 'Grand Total', value: `${cur} ${fmt(grandTotal)}`, isTotal: true });

  // Card border
  const boxH = rows.length * rowH + 4;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.setFillColor(...WHITE);
  doc.rect(boxX, y, boxW, boxH, 'FD');

  let ry = y + 2;
  rows.forEach(r => {
    if (r.isTotal) {
      doc.setFillColor(...EMERALD);
      doc.rect(boxX, ry, boxW, rowH, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(r.label.toUpperCase(), labelX, ry + 5.6);
      doc.text(r.value, valueX, ry + 5.6, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(r.label, labelX, ry + 5.6);
      if (r.pending) doc.setTextColor(180, 120, 0);
      doc.text(r.value, valueX, ry + 5.6, { align: 'right' });
    }
    ry += rowH;
  });

  const bottomOfBox = y + boxH;

  // Amount in words on the left
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.setFillColor(255, 251, 235);
  const wordsBoxW = tableW - boxW - 4;
  doc.rect(MARGIN_X, y, wordsBoxW, boxH, 'FD');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('AMOUNT IN WORDS', MARGIN_X + 3, y + 5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  const words = amountInWords(grandTotal, cur === 'Ksh' ? 'Kenya Shillings' : cur);
  const wl = doc.splitTextToSize(words, wordsBoxW - 6);
  doc.text(wl, MARGIN_X + 3, y + 10);

  return bottomOfBox + 6;
}

// ---------- Payment info ----------
function drawPaymentInfo(doc: jsPDF, w: number, y: number, data: DocumentData): number {
  if (!['invoice', 'receipt', 'quotation', 'service_certificate', 'pest_certificate'].includes(data.documentType)) return y;
  const p = pdfSettings.payment;
  const hasMpesa = p.mpesa_paybill || p.mpesa_till;
  const hasBank = p.bank_name && p.bank_account_number;
  const isReceiptOrCert = data.documentType === 'receipt' || data.documentType === 'service_certificate' || data.documentType === 'pest_certificate';
  const showProof = isReceiptOrCert && (data.mpesaCode || data.paymentDate);
  if (!hasMpesa && !hasBank && !showProof) return y;

  const brand = primary();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brand);
  doc.text(showProof ? 'PAYMENT CONFIRMATION' : 'PAYMENT DETAILS', MARGIN_X, y);
  y += 4;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_X, y, MARGIN_X + 40, y);
  y += 3;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...INK);

  if (showProof) {
    if (data.mpesaCode) { doc.text(`M-Pesa Code: ${data.mpesaCode}`, MARGIN_X, y); y += 4.5; }
    if (data.paymentDate) { doc.text(`Payment Date: ${data.paymentDate}`, MARGIN_X, y); y += 4.5; }
    if (data.invoiceNumber) { doc.text(`Invoice #: ${data.invoiceNumber}`, MARGIN_X, y); y += 4.5; }
    return y + 3;
  }

  if (p.mpesa_paybill) {
    doc.text(`M-Pesa Paybill: ${p.mpesa_paybill}${p.mpesa_account ? `  ·  Account: ${p.mpesa_account}` : ''}`, MARGIN_X, y);
    y += 4.5;
  }
  if (p.mpesa_till) {
    doc.text(`M-Pesa Till: ${p.mpesa_till}`, MARGIN_X, y);
    y += 4.5;
  }
  if (hasBank) {
    doc.text(
      `Bank: ${p.bank_name}${p.bank_branch ? ` (${p.bank_branch})` : ''}  ·  A/C: ${p.bank_account_number}` +
      (p.bank_account_name ? `  ·  Name: ${p.bank_account_name}` : ''),
      MARGIN_X, y,
    );
    y += 4.5;
  }
  return y + 3;
}

// ---------- Terms ----------
function drawTerms(doc: jsPDF, w: number, y: number, data: DocumentData): number {
  const isVoucher = data.documentType.includes('voucher');
  const terms = pdfSettings.document.terms_conditions;
  if (isVoucher || !terms) return y;

  const brand = primary();
  const tableW = w - MARGIN_X * 2;
  const lines = doc.splitTextToSize(terms, tableW - 8);
  const boxH = lines.length * 4 + 10;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_X, y, tableW, boxH, 'FD');

  // Left navy accent bar
  doc.setFillColor(...brand);
  doc.rect(MARGIN_X, y, 1.5, boxH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...brand);
  doc.text('TERMS & CONDITIONS', MARGIN_X + 5, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...INK);
  doc.text(lines, MARGIN_X + 5, y + 10);

  return y + boxH + 6;
}

// ---------- Acceptance ----------
function drawAcceptance(doc: jsPDF, w: number, y: number, data: DocumentData): number {
  if (data.documentType.includes('voucher')) return y;
  const tableW = w - MARGIN_X * 2;
  const colW = (tableW - 12) / 3;
  const boxH = 32;

  const boxes = [
    { title: 'CLIENT SIGNATURE', sub: 'Signature & Date', image: data.signatures?.clientSignature, name: data.signatures?.clientName },
    { title: 'SALES REPRESENTATIVE', sub: data.salespersonName || data.createdBy || '', image: data.signatures?.staffSignature, name: data.signatures?.staffName },
    { title: 'COMPANY STAMP', sub: 'Official Stamp', image: undefined, name: undefined },
  ];

  boxes.forEach((b, i) => {
    const x = MARGIN_X + (colW + 6) * i;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, colW, boxH, 'FD');

    if (b.image) {
      try { doc.addImage(b.image, 'PNG', x + 4, y + 5, colW - 8, 16); } catch { /* ignore */ }
    }

    // Baseline line
    doc.setDrawColor(...BORDER);
    doc.line(x + 4, y + boxH - 10, x + colW - 4, y + boxH - 10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(b.title, x + 4, y + boxH - 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...INK);
    doc.text(b.sub || '', x + 4, y + boxH - 1.5);
  });

  return y + boxH + 6;
}

// ---------- Footer ----------
function drawFooter(doc: jsPDF, w: number, h: number, data: DocumentData) {
  const brand = primary();
  const g = pdfSettings.general;
  const verificationCode = getVerificationCode(data.documentType, data.documentNumber);
  const footerY = h - 30;

  // QR bottom-right
  const qrSize = 20;
  const qrX = w - MARGIN_X - qrSize;
  const qrY = footerY - 2;
  const payload = buildVerificationPayload({
    companyName: g.company_name || 'Concept Cleaning Services',
    documentType: DOC_TITLES[data.documentType],
    documentNumber: data.documentNumber,
    clientName: data.clientName,
    issueDate: data.dateCreated,
    status: (data.paymentStatus || 'issued').toUpperCase(),
    verificationCode,
  });
  drawQrCode(doc, qrX, qrY, qrSize, payload);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  doc.text('Scan to verify', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });

  // Navy footer band
  doc.setFillColor(...brand);
  doc.rect(0, h - 10, w, 10, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, h - 11.5, w, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const contact = [g.website, g.email, g.phone].filter(Boolean).join('  ·  ');
  if (contact) doc.text(contact, w / 2, h - 4, { align: 'center' });

  // Verification block above footer band
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...INK);
  doc.text(`Verification Code: ${verificationCode}`, MARGIN_X, footerY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MUTED);
  const now = new Date();
  doc.text(`Generated ${now.toLocaleDateString()} ${now.toLocaleTimeString()} · By ${data.createdBy}`, MARGIN_X, footerY + 8.5);
  doc.setFont('helvetica', 'italic');
  doc.text('Concept Cleaning Services Management System', MARGIN_X, footerY + 13);
  const docFooter = pdfSettings.document.footer_text;
  if (docFooter) {
    doc.setFont('helvetica', 'normal');
    doc.text(docFooter, MARGIN_X, footerY + 17, { maxWidth: qrX - MARGIN_X - 4 });
  }
}

// ---------- Main ----------
export function generateDocumentPdf(data: DocumentData): jsPDF {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const g = pdfSettings.general;

  // Security layer (drawn first so all content sits on top)
  drawDiagonalWatermark(doc, w, h, getWatermarkText(data.documentType));
  drawCompanySeal(doc, w / 2, h / 2 + 30, {
    companyName: g.company_name,
    year: new Date().getFullYear(),
  });

  // Content
  let y = drawHeader(doc, w, data);
  y = drawMetaStrip(doc, w, y, data);
  y = drawClientCard(doc, w, y, data);
  y = drawTable(doc, data, y, w);
  y = drawSummary(doc, w, y, data);
  y = drawPaymentInfo(doc, w, y, data);
  y = drawTerms(doc, w, y, data);
  y = drawAcceptance(doc, w, y, data);

  // Gold "Certified & Verified" seal for receipts/certificates
  if (['receipt', 'service_certificate', 'pest_certificate'].includes(data.documentType)) {
    drawGoldCertifiedSeal(doc, w - 30, h - 70, 15);
  }

  drawFooter(doc, w, h, data);
  return doc;
}

export function downloadDocumentPdf(data: DocumentData): jsPDF {
  const doc = generateDocumentPdf(data);
  const num = data.documentNumber.replace(/^CCS-\w+-/, '');
  const prefix = FILE_PREFIXES[data.documentType];
  doc.save(`${prefix}-CCS-${num}.pdf`);
  return doc;
}

export type ShareMode = 'document_only' | 'document_with_review';

export interface ShareOptions {
  mode?: ShareMode;
  googleReviewUrl?: string;
}

export function shareDocumentWhatsApp(data: DocumentData, options: ShareOptions = {}) {
  downloadDocumentPdf(data);

  let phone = (data.clientPhone || '').replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
  if (!phone.startsWith('254')) phone = '254' + phone;

  const typeLabel = DOC_TITLES[data.documentType].toLowerCase();
  const isCert = data.documentType === 'service_certificate' || data.documentType === 'pest_certificate';
  const includeReview = options.mode === 'document_with_review';
  const reviewUrl = (options.googleReviewUrl || '').trim();

  let body =
    `Hello ${data.clientName || 'Valued Client'},\n\n` +
    `Please find attached the ${typeLabel} for your service from Concept Cleaning Services.\n\n` +
    `📋 ${DOC_TITLES[data.documentType]}: ${data.documentNumber}\n` +
    (data.lineItems[0] ? `🧹 Service: ${data.lineItems[0].name}\n` : '') +
    (data.serviceDate ? `📅 Date: ${data.serviceDate}\n` : '') +
    `💰 Amount: Ksh ${data.totalAmount.toLocaleString()}\n\n`;

  if (includeReview) {
    body +=
      `🙏 Thank you for choosing Concept Cleaning Services. We truly appreciate your business.\n\n` +
      `We'd love to hear your feedback! If you were happy with our service, kindly share a quick Google review — it really helps us grow.\n` +
      (reviewUrl ? `⭐ Leave a review: ${reviewUrl}\n\n` : `\n`) +
      `Customer Support: +254758060692`;
  } else {
    body +=
      (isCert
        ? `Thank you for choosing Concept Cleaning Services.\n\n`
        : `Kindly confirm if you would like us to proceed.\n\n`) +
      `Customer Support: +254758060692`;
  }

  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(body)}`, '_blank');
}
