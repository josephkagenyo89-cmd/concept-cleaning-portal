import jsPDF from 'jspdf';

export type DocumentType =
  | 'quotation'
  | 'invoice'
  | 'receipt'
  | 'fuel_voucher'
  | 'salary_voucher'
  | 'expense_voucher'
  | 'booking_confirmation'
  | 'job_card';

const DOC_TITLES: Record<DocumentType, string> = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  receipt: 'Receipt',
  fuel_voucher: 'Fuel Voucher',
  salary_voucher: 'Salary Voucher',
  expense_voucher: 'Expense Voucher',
  booking_confirmation: 'Booking Confirmation',
  job_card: 'Job Card',
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
};

export interface DocumentLineItem {
  name: string;
  description?: string;
  quantity?: string | number;
  unitPrice?: number;
  total: number;
}

export interface DocumentData {
  documentType: DocumentType;
  documentNumber: string;
  dateCreated: string;
  createdBy: string;
  createdByRole: string;
  clientName?: string;
  clientPhone?: string;
  clientLocation?: string;
  staffName?: string;
  department?: string;
  paymentReason?: string;
  lineItems: DocumentLineItem[];
  totalAmount: number;
  paymentStatus?: string;
  notes?: string;
  serviceDate?: string;
}

// Brand colors
const TEAL: [number, number, number] = [42, 157, 143]; // #2A9D8F
const DARK: [number, number, number] = [33, 37, 41];
const GRAY_TEXT: [number, number, number] = [100, 100, 100];
const LIGHT_BG: [number, number, number] = [245, 245, 245];
const WHITE: [number, number, number] = [255, 255, 255];
const BORDER_GRAY: [number, number, number] = [200, 200, 200];

function fmt(n: number): string {
  return n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function drawHeader(doc: jsPDF, w: number): number {
  // Soft curved background shape (top-left arc)
  doc.setFillColor(220, 240, 237); // light teal
  doc.ellipse(-20, -10, 100, 60, 'F');

  // Company name left
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEAL);
  doc.text('CONCEPT CLEANING AND FUMIGATION', 18, 28);

  // Right side company details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('CONCEPT CLEANING SERVICES', w - 18, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY_TEXT);
  doc.text('NAIROBI', w - 18, 20, { align: 'right' });
  doc.text('Nairobi Kenya', w - 18, 25, { align: 'right' });

  return 38;
}

function drawDocTitle(doc: jsPDF, w: number, y: number, data: DocumentData): number {
  const title = DOC_TITLES[data.documentType];
  const numLabel = `${title} # ${data.documentNumber}`;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEAL);
  doc.text(numLabel, w - 18, y, { align: 'right' });
  doc.setTextColor(...DARK);

  return y + 10;
}

function drawClientSection(doc: jsPDF, y: number, data: DocumentData): number {
  const isStaff = data.documentType.includes('voucher');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);

  if (isStaff && data.staffName) {
    doc.text(data.staffName.toUpperCase(), 18, y);
    y += 5;
    if (data.department) {
      doc.setFont('helvetica', 'normal');
      doc.text(data.department, 18, y);
      y += 5;
    }
    if (data.paymentReason) {
      doc.setFont('helvetica', 'normal');
      doc.text(data.paymentReason, 18, y);
      y += 5;
    }
  } else if (data.clientName) {
    doc.text(data.clientName.toUpperCase(), 18, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    if (data.clientLocation) {
      doc.text(data.clientLocation, 18, y);
      y += 5;
    }
    if (data.clientPhone) {
      doc.text(data.clientPhone, 18, y);
      y += 5;
    }
  }

  return y + 4;
}

function drawInfoBox(doc: jsPDF, w: number, y: number, data: DocumentData): number {
  const marginX = 18;
  const boxW = w - 36;
  const boxH = 14;

  // Border
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(marginX, y, boxW, boxH, 'S');

  // Columns
  const col1 = marginX + 2;
  const col2 = marginX + boxW * 0.35;
  const col3 = marginX + boxW * 0.65;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_TEXT);

  // Labels
  const labelY = y + 4.5;
  doc.text('Date', col1, labelY);

  const isQuotation = data.documentType === 'quotation';
  doc.text(isQuotation ? 'Expiration' : 'Service Date', col2, labelY);
  doc.text('Salesperson', col3, labelY);

  // Dividers
  doc.line(col2 - 2, y, col2 - 2, y + boxH);
  doc.line(col3 - 2, y, col3 - 2, y + boxH);

  // Values
  const valY = y + 10.5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.setFontSize(8.5);
  doc.text(data.dateCreated, col1, valY);
  doc.text(data.serviceDate || '-', col2, valY);
  doc.text(data.createdBy, col3, valY);

  return y + boxH + 6;
}

function drawTable(doc: jsPDF, data: DocumentData, y: number, w: number): number {
  const marginX = 18;
  const tableW = w - 36;
  const isVoucher = data.documentType.includes('voucher');

  // Column widths
  let cols: { label: string; x: number; w: number; align: 'left' | 'right' }[];
  if (isVoucher) {
    cols = [
      { label: 'DESCRIPTION', x: marginX, w: tableW * 0.55, align: 'left' },
      { label: 'DETAILS', x: marginX + tableW * 0.55, w: tableW * 0.25, align: 'left' },
      { label: 'AMOUNT', x: marginX + tableW * 0.8, w: tableW * 0.2, align: 'right' },
    ];
  } else {
    cols = [
      { label: 'DESCRIPTION', x: marginX, w: tableW * 0.40, align: 'left' },
      { label: 'QUANTITY', x: marginX + tableW * 0.40, w: tableW * 0.13, align: 'right' },
      { label: 'UNIT PRICE', x: marginX + tableW * 0.53, w: tableW * 0.15, align: 'right' },
      { label: 'TAXES', x: marginX + tableW * 0.68, w: tableW * 0.12, align: 'right' },
      { label: 'AMOUNT', x: marginX + tableW * 0.80, w: tableW * 0.20, align: 'right' },
    ];
  }

  const rowH = 10;
  const headerH = 8;

  // Header row
  doc.setFillColor(...TEAL);
  doc.rect(marginX, y, tableW, headerH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);

  cols.forEach(col => {
    const tx = col.align === 'right' ? col.x + col.w - 3 : col.x + 3;
    doc.text(col.label, tx, y + 5.5, { align: col.align === 'right' ? 'right' : 'left' });
  });

  y += headerH;

  // Data rows
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  data.lineItems.forEach((item) => {
    // Row border bottom
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.2);
    doc.line(marginX, y + rowH, marginX + tableW, y + rowH);

    if (isVoucher) {
      doc.text(item.name, cols[0].x + 3, y + 6.5);
      doc.text(item.description || '', cols[1].x + 3, y + 6.5);
      doc.text(`${fmt(item.total)} Ksh`, cols[2].x + cols[2].w - 3, y + 6.5, { align: 'right' });
    } else {
      // Description (may be multiline)
      const descLines = doc.splitTextToSize(
        `${item.name}${item.description ? '\n' + item.description : ''}`,
        cols[0].w - 6
      );
      doc.text(descLines, cols[0].x + 3, y + 5);
      const qty = item.quantity ? `${item.quantity} Units` : '1.00 Units';
      doc.text(qty, cols[1].x + cols[1].w - 3, y + 6.5, { align: 'right' });
      doc.text(item.unitPrice ? fmt(item.unitPrice) : '-', cols[2].x + cols[2].w - 3, y + 6.5, { align: 'right' });
      doc.text('Exempt', cols[3].x + cols[3].w - 3, y + 6.5, { align: 'right' });
      doc.text(`${fmt(item.total)} KSh`, cols[4].x + cols[4].w - 3, y + 6.5, { align: 'right' });
    }

    y += rowH;
  });

  // Outer border
  const tableStartY = y - data.lineItems.length * rowH - headerH;
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(marginX, tableStartY, tableW, y - tableStartY, 'S');

  return y + 4;
}

function drawSummary(doc: jsPDF, w: number, y: number, data: DocumentData): number {
  const marginX = 18;
  const tableW = w - 36;
  const summaryX = marginX + tableW * 0.55;
  const summaryW = tableW * 0.45;
  const labelX = summaryX + 3;
  const valueX = summaryX + summaryW - 3;
  const rowH = 9;

  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);

  // Untaxed Amount
  doc.rect(summaryX, y, summaryW, rowH, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  doc.text('Untaxed Amount', labelX, y + 6);
  doc.text(fmt(data.totalAmount), valueX, y + 6, { align: 'right' });
  y += rowH;

  // VAT
  doc.rect(summaryX, y, summaryW, rowH, 'S');
  doc.text('VAT 0%', labelX, y + 6);
  doc.text('0.00 KSh', valueX, y + 6, { align: 'right' });
  y += rowH;

  // Total
  doc.setFillColor(...TEAL);
  doc.rect(summaryX, y, summaryW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('Total', labelX, y + 6);
  doc.text(`${fmt(data.totalAmount)} Ksh`, valueX, y + 6, { align: 'right' });
  doc.setTextColor(...DARK);

  return y + rowH + 8;
}

function drawTermsAndNotes(doc: jsPDF, y: number, data: DocumentData): number {
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_TEXT);

  if (data.documentType === 'quotation') {
    doc.text('Terms & Conditions: Quotation valid 30 days.', 18, y);
    y += 6;
  }

  if (data.paymentStatus) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`Payment Status: ${data.paymentStatus.toUpperCase()}`, 18, y);
    y += 6;
  }

  if (data.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY_TEXT);
    const noteLines = doc.splitTextToSize(`Notes: ${data.notes}`, 170);
    doc.text(noteLines, 18, y);
    y += noteLines.length * 4 + 4;
  }

  return y;
}

function drawFooter(doc: jsPDF, w: number, h: number, pageNum: number, totalPages: number) {
  const footerY = h - 18;

  // Separator line
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.5);
  doc.line(18, footerY, w - 18, footerY);

  // Contact info
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_TEXT);
  doc.text(
    '+254758060692  info.conceptcleaningkenya@gmail.com  https://concept-cleaning-services.lovable.app/',
    w / 2,
    footerY + 6,
    { align: 'center' }
  );

  // Page number
  doc.text(`Page ${pageNum} / ${totalPages}`, w / 2, footerY + 11, { align: 'center' });
}

export function generateDocumentPdf(data: DocumentData): jsPDF {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  let y = drawHeader(doc, w);
  y = drawClientSection(doc, y, data);
  y = drawDocTitle(doc, w, y, data);
  y += 2;
  y = drawInfoBox(doc, w, y, data);
  y = drawTable(doc, data, y, w);
  y = drawSummary(doc, w, y, data);
  y = drawTermsAndNotes(doc, y, data);

  drawFooter(doc, w, h, 1, 1);

  return doc;
}

export function downloadDocumentPdf(data: DocumentData): jsPDF {
  const doc = generateDocumentPdf(data);
  const num = data.documentNumber.replace(/^CCS-\w+-/, '');
  const prefix = FILE_PREFIXES[data.documentType];
  doc.save(`${prefix}-CCS-${num}.pdf`);
  return doc;
}

export function shareDocumentWhatsApp(data: DocumentData) {
  downloadDocumentPdf(data);

  let phone = (data.clientPhone || '').replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
  if (!phone.startsWith('254')) phone = '254' + phone;

  const typeLabel = DOC_TITLES[data.documentType].toLowerCase();
  const message = encodeURIComponent(
    `Hello ${data.clientName || 'Valued Client'},\n\n` +
    `Please find attached the ${typeLabel} for your cleaning service from Concept Cleaning Services.\n\n` +
    `📋 ${DOC_TITLES[data.documentType]}: ${data.documentNumber}\n` +
    (data.lineItems[0] ? `🧹 Service: ${data.lineItems[0].name}\n` : '') +
    (data.serviceDate ? `📅 Date: ${data.serviceDate}\n` : '') +
    `💰 Amount: Ksh ${data.totalAmount.toLocaleString()}\n\n` +
    `Kindly confirm if you would like us to proceed.\n\n` +
    `Customer Support: +254758060692`
  );

  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
}
