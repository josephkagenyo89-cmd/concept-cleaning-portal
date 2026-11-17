import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ServiceRow {
  id?: string;
  category_id?: string | null;
  service_category?: { id?: string; name?: string } | null;
  category_name?: string | null;
  service_code?: string | null;
  name: string;
  description?: string | null;
  short_description?: string | null;
  base_price: number;
  pricing_unit?: string | null;
  estimated_duration?: string | null;
  commission_eligible?: boolean;
  is_active?: boolean;
}

// Category labels are exported from the joined service_categories relation.
// Only service_category_id is authoritative when importing or changing a link.
const CSV_HEADERS = [
  'id', 'service_code', 'name', 'service_category', 'service_category_id',
  'description', 'short_description', 'base_price', 'pricing_unit',
  'estimated_duration', 'commission_eligible', 'is_active',
] as const;

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function servicesToCsv(services: ServiceRow[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const s of services) {
    const values = [
      s.id,
      s.service_code,
      s.name,
      s.service_category?.name || s.category_name || '',
      s.category_id,
      s.description,
      s.short_description,
      s.base_price,
      s.pricing_unit,
      s.estimated_duration,
      s.commission_eligible,
      s.is_active,
    ];
    lines.push(values.map(csvEscape).join(','));
  }
  return lines.join('\n');
}

export function downloadServicesCsv(services: ServiceRow[]) {
  const blob = new Blob([servicesToCsv(services)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `services-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadServicesPdf(services: ServiceRow[], companyName = 'Concept Cleaning Services') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(15);
  doc.setTextColor(11, 61, 145);
  doc.text(`${companyName} — Service Catalogue`, 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()} · ${services.length} services`, 40, 56);

  autoTable(doc, {
    startY: 72,
    head: [['Code', 'Service', 'Category', 'Category UUID', 'Description', 'Base Price (Ksh)', 'Unit', 'Duration', 'Active']],
    body: services.map(s => [
      s.service_code || '',
      s.name,
      s.service_category?.name || s.category_name || '',
      s.category_id || '',
      s.description || '',
      Number(s.base_price || 0).toLocaleString(),
      s.pricing_unit || '',
      s.estimated_duration || '',
      s.is_active === false ? 'No' : 'Yes',
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [11, 61, 145], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    columnStyles: { 2: { cellWidth: 170 }, 4: { cellWidth: 220 }, 5: { halign: 'right' } },
  });

  doc.save(`services-${new Date().toISOString().slice(0, 10)}.pdf`);
}
