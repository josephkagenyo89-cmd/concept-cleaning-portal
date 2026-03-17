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
  quotation: 'QUOTATION',
  invoice: 'INVOICE',
  receipt: 'RECEIPT',
  fuel_voucher: 'FUEL VOUCHER',
  salary_voucher: 'SALARY VOUCHER',
  expense_voucher: 'EXPENSE VOUCHER',
  booking_confirmation: 'BOOKING CONFIRMATION',
  job_card: 'JOB CARD',
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

  // Client details (for client docs)
  clientName?: string;
  clientPhone?: string;
  clientLocation?: string;

  // Staff details (for vouchers)
  staffName?: string;
  department?: string;
  paymentReason?: string;

  // Line items
  lineItems: DocumentLineItem[];

  // Total
  totalAmount: number;

  // Optional
  paymentStatus?: string;
  notes?: string;
  serviceDate?: string;
}

const PRIMARY_COLOR: [number, number, number] = [14, 119, 86];

function drawHeader(doc: jsPDF, w: number): number {
  let y = 20;
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Concept Cleaning Services', w / 2, y, { align: 'center' });

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Professional Cleaning Solutions', w / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Customer Support: 0796563741', w / 2, y, { align: 'center' });

  y += 5;
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.6);
  doc.line(20, y, w - 20, y);

  return y + 8;
}

function drawTitle(doc: jsPDF, w: number, y: number, type: DocumentType): number {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(DOC_TITLES[type], w / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  return y + 10;
}

function drawInfoRow(doc: jsPDF, label: string, value: string, x: number, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.text(value, x + 50, y);
  return y + 7;
}

function drawTable(doc: jsPDF, data: DocumentData, y: number, w: number): number {
  const isVoucher = data.documentType.includes('voucher');
  const marginX = 20;
  const tableW = w - 40;

  // Header row
  doc.setFillColor(14, 119, 86);
  doc.rect(marginX, y, tableW, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);

  if (isVoucher) {
    doc.text('Item', marginX + 4, y + 6);
    doc.text('Description', marginX + 50, y + 6);
    doc.text('Amount (Ksh)', marginX + tableW - 35, y + 6);
  } else {
    doc.text('Service / Item', marginX + 4, y + 6);
    doc.text('Qty', marginX + 90, y + 6);
    doc.text('Unit Price', marginX + 110, y + 6);
    doc.text('Total (Ksh)', marginX + tableW - 35, y + 6);
  }

  y += 9;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  data.lineItems.forEach((item, i) => {
    const bgColor = i % 2 === 0 ? 248 : 255;
    doc.setFillColor(bgColor, bgColor, bgColor);
    doc.rect(marginX, y, tableW, 8, 'F');

    if (isVoucher) {
      doc.text(item.name, marginX + 4, y + 6);
      doc.text(item.description || '', marginX + 50, y + 6);
      doc.text(`${item.total.toLocaleString()}`, marginX + tableW - 35, y + 6);
    } else {
      doc.text(item.name, marginX + 4, y + 6);
      doc.text(String(item.quantity || '1'), marginX + 90, y + 6);
      doc.text(item.unitPrice ? item.unitPrice.toLocaleString() : '-', marginX + 110, y + 6);
      doc.text(`${item.total.toLocaleString()}`, marginX + tableW - 35, y + 6);
    }
    y += 8;
  });

  // Border
  doc.setDrawColor(200, 200, 200);
  doc.rect(marginX, y - data.lineItems.length * 8 - 9, tableW, data.lineItems.length * 8 + 9, 'S');

  return y + 5;
}

export function generateDocumentPdf(data: DocumentData): jsPDF {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  let y = drawHeader(doc, w);
  y = drawTitle(doc, w, y, data.documentType);

  // Document info
  y = drawInfoRow(doc, 'Document No:', data.documentNumber, 25, y);
  y = drawInfoRow(doc, 'Date:', data.dateCreated, 25, y);
  y = drawInfoRow(doc, 'Created By:', data.createdBy, 25, y);
  y = drawInfoRow(doc, 'Role:', data.createdByRole, 25, y);

  if (data.serviceDate) {
    y = drawInfoRow(doc, 'Service Date:', data.serviceDate, 25, y);
  }

  y += 3;

  // Client or staff details
  const isStaffDoc = data.documentType.includes('voucher');
  if (isStaffDoc && data.staffName) {
    doc.setDrawColor(220, 220, 220);
    doc.line(20, y, w - 20, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Staff Details', 25, y);
    y += 7;
    y = drawInfoRow(doc, 'Staff Name:', data.staffName, 25, y);
    if (data.department) y = drawInfoRow(doc, 'Department:', data.department, 25, y);
    if (data.paymentReason) y = drawInfoRow(doc, 'Reason:', data.paymentReason, 25, y);
  } else if (data.clientName) {
    doc.setDrawColor(220, 220, 220);
    doc.line(20, y, w - 20, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Client Details', 25, y);
    y += 7;
    y = drawInfoRow(doc, 'Client Name:', data.clientName, 25, y);
    if (data.clientPhone) y = drawInfoRow(doc, 'Phone:', data.clientPhone, 25, y);
    if (data.clientLocation) y = drawInfoRow(doc, 'Location:', data.clientLocation, 25, y);
  }

  y += 5;

  // Transaction table
  if (data.lineItems.length > 0) {
    y = drawTable(doc, data, y, w);
  }

  // Total
  const totalY = y + 2;
  doc.setFillColor(240, 249, 244);
  doc.roundedRect(20, totalY - 4, w - 40, 16, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Total Amount:', 28, totalY + 7);
  doc.setTextColor(...PRIMARY_COLOR);
  doc.text(`Ksh ${data.totalAmount.toLocaleString()}`, w - 28, totalY + 7, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  y = totalY + 20;

  // Payment status if present
  if (data.paymentStatus) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Payment Status: ${data.paymentStatus.toUpperCase()}`, 25, y);
    y += 8;
  }

  // Notes
  if (data.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`Notes: ${data.notes}`, 25, y, { maxWidth: w - 50 });
    y += 12;
  }

  // Footer
  const footerY = Math.max(y + 10, 250);
  doc.setDrawColor(...PRIMARY_COLOR);
  doc.setLineWidth(0.4);
  doc.line(20, footerY, w - 20, footerY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for choosing Concept Cleaning Services.', w / 2, footerY + 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Customer Support: 0796563741', w / 2, footerY + 14, { align: 'center' });

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
    `Customer Support: 0796563741`
  );

  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
}
