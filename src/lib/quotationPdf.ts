import { generateDocumentPdf, DocumentData } from './documentPdf';
import jsPDF from 'jspdf';

interface LineItemInput {
  name: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
}

interface QuotationData {
  quotationNumber: string;
  quotationDate: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  serviceDate: string;
  price: number;
  subtotal?: number;
  discountAmount?: number;
  discountReason?: string;
  lineItems?: LineItemInput[];
  salespersonName?: string;
}

function toDocData(data: QuotationData): DocumentData {
  const items = data.lineItems && data.lineItems.length > 0
    ? data.lineItems.map(i => ({ name: i.name, quantity: i.quantity || 1, unitPrice: i.unitPrice || i.total, total: i.total }))
    : [{ name: data.serviceName, quantity: 1, unitPrice: data.price, total: data.price }];

  return {
    documentType: 'quotation',
    documentNumber: data.quotationNumber,
    dateCreated: data.quotationDate,
    createdBy: data.salespersonName || '-',
    createdByRole: '-',
    clientName: data.clientName,
    clientPhone: data.clientPhone,
    lineItems: items,
    totalAmount: data.price,
    subtotal: data.subtotal,
    discountAmount: data.discountAmount,
    discountReason: data.discountReason,
    serviceDate: data.serviceDate,
  };
}

export function generateQuotationPdf(data: QuotationData): jsPDF {
  return generateDocumentPdf(toDocData(data));
}

export function downloadQuotationPdf(data: QuotationData) {
  const doc = generateQuotationPdf(data);
  const num = data.quotationNumber.replace('CCS-QT-', '');
  doc.save(`Quotation-CCS-${num}.pdf`);
  return doc;
}

export function shareQuotationWhatsApp(data: QuotationData) {
  downloadQuotationPdf(data);

  let phone = data.clientPhone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
  if (!phone.startsWith('254')) phone = '254' + phone;

  const items = data.lineItems && data.lineItems.length > 0 ? data.lineItems : [{ name: data.serviceName, total: data.price }];
  const serviceList = items.map(i => `  • ${i.name}: Ksh ${i.total.toLocaleString()}`).join('\n');

  const message = encodeURIComponent(
    `Hello ${data.clientName},\n\nPlease find your quotation from Concept Cleaning Services:\n\n` +
    `📋 Quotation: ${data.quotationNumber}\n` +
    `🧹 Services:\n${serviceList}\n` +
    `📅 Date: ${data.serviceDate}\n` +
    `💰 Total: Ksh ${data.price.toLocaleString()}\n\n` +
    `Thank you for choosing Concept Cleaning Services.\nCustomer Support: +254758060692`
  );

  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
}
