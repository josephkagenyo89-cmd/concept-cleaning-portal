import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadAllSettings } from '@/lib/settings';

export interface AccountingPdfInput {
  title: string;
  period?: string;
  columns: string[];
  rows: (string | number)[][];
  totals?: string[];
  filters?: string[];
}

async function imageDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'accounting-report';
}

export async function downloadAccountingPdf(input: AccountingPdfInput) {
  const settings = await loadAllSettings();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const primary = settings.document.primary_color && settings.document.primary_color.toLowerCase() !== '#2a9d8f'
    ? settings.document.primary_color : '#0B3D91';
  const rgb = (hex: string): [number, number, number] => {
    const value = hex.replace('#', '');
    const normalized = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
    const parsed = parseInt(normalized, 16);
    return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
  };
  const brand = rgb(primary);
  const logo = settings.general.logo_url ? await imageDataUrl(settings.general.logo_url) : null;
  const generatedAt = new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
  const company = settings.general.company_name || 'Concept Cleaning Services';
  const currency = settings.system.currency || 'KES';

  const drawHeader = () => {
    if (logo) {
      try { doc.addImage(logo, logo.startsWith('data:image/png') ? 'PNG' : 'JPEG', 14, 7, 19, 12, undefined, 'FAST'); } catch { /* optional logo */ }
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...brand);
    doc.text(company, logo ? 37 : 14, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 108, 120);
    doc.text('ACCOUNTING & FINANCE', pageWidth - 14, 12, { align: 'right' });
    doc.setDrawColor(...brand);
    doc.setLineWidth(0.5);
    doc.line(14, 18, pageWidth - 14, 18);
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(40, 45, 52);
  doc.text(input.title, 14, 29);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 108, 120);
  doc.text('Period: ' + (input.period || 'All available dates'), 14, 35);
  doc.text('Generated: ' + generatedAt, pageWidth - 14, 35, { align: 'right' });
  if (input.filters?.length) {
    const filterText = input.filters.join('  |  ');
    const lines = doc.splitTextToSize(filterText, pageWidth - 28);
    doc.text(lines, 14, 40);
  }

  const startY = input.filters?.length ? 44 + Math.min(input.filters.length - 1, 2) * 3.5 : 41;
  autoTable(doc, {
    startY,
    head: [input.columns],
    body: input.rows.map((row) => row.map((cell) => String(cell ?? '—'))),
    theme: 'grid',
    margin: { left: 14, right: 14, top: 25, bottom: 18 },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.2, overflow: 'linebreak', textColor: [45, 50, 58], lineColor: [220, 225, 232], lineWidth: 0.15 },
    headStyles: { fillColor: brand, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didDrawPage: () => {
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(110, 118, 129);
      doc.text('Confidential financial record · ' + currency, 14, pageHeight - 8);
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || startY + 8;
  if (input.totals?.length) {
    let y = finalY + 7;
    if (y > pageHeight - 22) { doc.addPage(); y = 28; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...brand);
    doc.text('TOTALS', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(45, 50, 58);
    input.totals.forEach((line) => {
      y += 4.5;
      doc.text(line, 14, y);
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(110, 118, 129);
    doc.text('Page ' + page + ' of ' + pageCount, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
  doc.save(safeFileName(input.title) + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
}
