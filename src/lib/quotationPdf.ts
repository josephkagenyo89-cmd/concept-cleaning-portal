import { generateDocumentPdf, downloadDocumentPdf as downloadDoc, DocumentData } from './documentPdf';
import jsPDF from 'jspdf';

interface QuotationData {
  quotationNumber: string;
  quotationDate: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  serviceDate: string;
  price: number;
}

function toDocData(data: QuotationData): DocumentData {
  return {
    documentType: 'quotation',
    documentNumber: data.quotationNumber,
    dateCreated: data.quotationDate,
    createdBy: '-',
    createdByRole: '-',
    clientName: data.clientName,
    clientPhone: data.clientPhone,
    lineItems: [{ name: data.serviceName, quantity: 1, unitPrice: data.price, total: data.price }],
    totalAmount: data.price,
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

  const message = encodeURIComponent(
    `Hello ${data.clientName},\n\nPlease find your quotation from Concept Cleaning Services:\n\n` +
    `📋 Quotation: ${data.quotationNumber}\n` +
    `🧹 Service: ${data.serviceName}\n` +
    `📅 Date: ${data.serviceDate}\n` +
    `💰 Price: Ksh ${data.price.toLocaleString()}\n\n` +
    `Thank you for choosing Concept Cleaning Services.\nCustomer Support: +254758060692`
  );

  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
}
