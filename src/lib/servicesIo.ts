import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceRow {
  id?: string;
  service_code?: string | null;
  name: string;
  category: string;
  description?: string | null;
  short_description?: string | null;
  base_price: number;
  pricing_unit?: string | null;
  estimated_duration?: string | null;
  commission_eligible?: boolean;
  is_active?: boolean;
}

const CSV_HEADERS = [
  'service_code', 'name', 'category', 'description', 'short_description', 'base_price',
  'pricing_unit', 'estimated_duration', 'commission_eligible', 'is_active',
] as const;

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function servicesToCsv(services: ServiceRow[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const s of services) {
    lines.push(CSV_HEADERS.map(h => csvEscape((s as any)[h])).join(','));
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

/** Minimal RFC4180-ish CSV parser (handles quoted fields and embedded commas). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

const truthy = (v: string) => ['1', 'true', 'yes', 'y'].includes((v || '').trim().toLowerCase());

export interface ImportResult { created: number; updated: number; skipped: number; errors: string[] }

/**
 * Imports services from CSV. Matching is by service name (case-insensitive) so
 * re-importing updates existing services instead of creating duplicates.
 */
export async function importServicesCsv(text: string, existing: ServiceRow[]): Promise<ImportResult> {
  const rows = parseCsv(text);
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  if (rows.length < 2) { result.errors.push('CSV has no data rows.'); return result; }

  const header = rows[0].map(h => h.trim().toLowerCase());
  const idx = (key: string) => header.indexOf(key);
  if (idx('name') === -1) { result.errors.push('CSV must include a "name" column.'); return result; }

  const byName = new Map(existing.map(s => [s.name.trim().toLowerCase(), s]));
  const seen = new Set<string>();

  for (const r of rows.slice(1)) {
    const get = (key: string) => (idx(key) === -1 ? '' : (r[idx(key)] ?? '').trim());
    const name = get('name');
    if (!name) { result.skipped++; continue; }
    const key = name.toLowerCase();
    if (seen.has(key)) { result.skipped++; continue; }
    seen.add(key);

    const payload: any = {
      name,
      category: get('category') || 'Residential Cleaning',
      description: get('description') || null,
      base_price: Number(get('base_price')) || 0,
      pricing_model: 'fixed',
      pricing_unit: get('pricing_unit') || 'fixed',
      input_type: 'number',
    };
    if (idx('short_description') !== -1) payload.short_description = get('short_description') || null;
    if (idx('estimated_duration') !== -1) payload.estimated_duration = get('estimated_duration') || null;
    if (idx('commission_eligible') !== -1) payload.commission_eligible = truthy(get('commission_eligible'));
    if (idx('is_active') !== -1) payload.is_active = truthy(get('is_active'));

    const match = byName.get(key);
    const { error } = match?.id
      ? await supabase.from('services').update(payload).eq('id', match.id)
      : await supabase.from('services').insert(payload);

    if (error) result.errors.push(`${name}: ${error.message}`);
    else if (match?.id) result.updated++;
    else result.created++;
  }
  return result;
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
    head: [['Service', 'Category', 'Description', 'Base Price (Ksh)', 'Unit', 'Duration', 'Active']],
    body: services.map(s => [
      s.name,
      s.category || '',
      s.description || '',
      Number(s.base_price || 0).toLocaleString(),
      s.pricing_unit || '',
      s.estimated_duration || '',
      s.is_active === false ? 'No' : 'Yes',
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [11, 61, 145], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    columnStyles: { 2: { cellWidth: 230 }, 3: { halign: 'right' } },
  });

  doc.save(`services-${new Date().toISOString().slice(0, 10)}.pdf`);
}
