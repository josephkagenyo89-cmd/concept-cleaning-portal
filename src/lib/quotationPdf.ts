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

export function generateQuotationPdf(data: QuotationData): jsPDF {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Concept Cleaning Services', w / 2, 25, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(14, 119, 86);
  doc.text('QUOTATION', w / 2, 35, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Line
  doc.setDrawColor(14, 119, 86);
  doc.setLineWidth(0.5);
  doc.line(20, 40, w - 20, 40);

  // Quotation details
  const startY = 52;
  const labelX = 25;
  const valueX = 85;
  const lineH = 10;

  doc.setFontSize(11);
  const fields: [string, string][] = [
    ['Quotation No:', data.quotationNumber],
    ['Date:', data.quotationDate],
    ['Client Name:', data.clientName],
    ['Client Phone:', data.clientPhone],
    ['Service:', data.serviceName],
    ['Service Date:', data.serviceDate],
  ];

  fields.forEach(([label, value], i) => {
    const y = startY + i * lineH;
    doc.setFont('helvetica', 'bold');
    doc.text(label, labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, valueX, y);
  });

  // Price box
  const priceY = startY + fields.length * lineH + 5;
  doc.setFillColor(240, 249, 244);
  doc.roundedRect(20, priceY - 5, w - 40, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Total Price:', labelX, priceY + 7);
  doc.setTextColor(14, 119, 86);
  doc.text(`Ksh ${data.price.toLocaleString()}`, valueX + 20, priceY + 7);
  doc.setTextColor(0, 0, 0);

  // Footer
  const footerY = priceY + 40;
  doc.setDrawColor(14, 119, 86);
  doc.line(20, footerY, w - 20, footerY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for choosing Concept Cleaning Services.', w / 2, footerY + 10, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Customer Support: 0796563741', w / 2, footerY + 18, { align: 'center' });

  return doc;
}

export function downloadQuotationPdf(data: QuotationData) {
  const doc = generateQuotationPdf(data);
  const num = data.quotationNumber.replace('CCS-QT-', '');
  doc.save(`Quotation-CCS-${num}.pdf`);
  return doc;
}

export function shareQuotationWhatsApp(data: QuotationData) {
  // Generate and download the PDF first
  downloadQuotationPdf(data);

  // Format phone for WhatsApp (Kenya)
  let phone = data.clientPhone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
  if (!phone.startsWith('254')) phone = '254' + phone;

  const message = encodeURIComponent(
    `Hello ${data.clientName},\n\nPlease find your quotation from Concept Cleaning Services:\n\n` +
    `📋 Quotation: ${data.quotationNumber}\n` +
    `🧹 Service: ${data.serviceName}\n` +
    `📅 Date: ${data.serviceDate}\n` +
    `💰 Price: Ksh ${data.price.toLocaleString()}\n\n` +
    `Thank you for choosing Concept Cleaning Services.\nCustomer Support: 0796563741`
  );

  window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
}
