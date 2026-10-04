import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Database } from '@/integrations/supabase/types';

export type Compensation = Database['public']['Tables']['employee_compensation']['Row'];
export type PayComponent = Database['public']['Tables']['employee_pay_components']['Row'];
export type PayrollRun = Database['public']['Tables']['payroll_runs']['Row'];
export type PayrollItem = Database['public']['Tables']['payroll_items']['Row'];

/** Kenya statutory rates (Finance Act 2023, SHIF Act, Tax Laws (Amendment) Act 2024, NSSF Feb-2025 limits). */
export const KE_RATES = {
  nssfRate: 0.06,
  nssfLowerLimit: 8000,
  nssfUpperLimit: 72000,
  shifRate: 0.0275,
  shifMinimum: 300,
  housingLevyRate: 0.015,
  personalRelief: 2400,
  payeBands: [
    { upTo: 24000, rate: 0.10 },
    { upTo: 32333, rate: 0.25 },
    { upTo: 500000, rate: 0.30 },
    { upTo: 800000, rate: 0.325 },
    { upTo: Infinity, rate: 0.35 },
  ],
};

export const PAYMENT_METHODS = ['mpesa', 'bank', 'cash'] as const;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const kes = (n?: number | null) =>
  'KES ' + Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function calcPaye(taxable: number) {
  let tax = 0, prev = 0;
  for (const b of KE_RATES.payeBands) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, b.upTo) - prev) * b.rate;
    prev = b.upTo;
  }
  return r2(tax);
}

export interface Line { name: string; amount: number; taxable?: boolean }
export interface PayInput {
  basic: number;
  allowances: Line[];
  bonus?: number;
  overtime?: number;
  deductions: Line[];
  oneOffDeduction?: number;
  exempt?: { nssf?: boolean; shif?: boolean; housing?: boolean; paye?: boolean };
}

export function computePay(i: PayInput) {
  const allowances = r2(i.allowances.reduce((s, a) => s + Number(a.amount || 0), 0));
  const nonTaxable = r2(i.allowances.filter((a) => a.taxable === false).reduce((s, a) => s + Number(a.amount || 0), 0));
  const bonus = Number(i.bonus || 0), overtime = Number(i.overtime || 0);
  const gross = r2(Number(i.basic || 0) + allowances + bonus + overtime);
  const pensionable = gross - nonTaxable;
  const ex = i.exempt || {};

  const nssf1 = ex.nssf ? 0 : r2(Math.min(pensionable, KE_RATES.nssfLowerLimit) * KE_RATES.nssfRate);
  const nssf2 = ex.nssf ? 0 : r2(Math.max(0, Math.min(pensionable, KE_RATES.nssfUpperLimit) - KE_RATES.nssfLowerLimit) * KE_RATES.nssfRate);
  const shif = ex.shif || gross <= 0 ? 0 : r2(Math.max(KE_RATES.shifMinimum, gross * KE_RATES.shifRate));
  const housing = ex.housing ? 0 : r2(gross * KE_RATES.housingLevyRate);
  // Since Dec 2024, NSSF, SHIF and Housing Levy are deductible before PAYE.
  const taxable = r2(Math.max(0, gross - nonTaxable - nssf1 - nssf2 - shif - housing));
  const payeGross = ex.paye ? 0 : calcPaye(taxable);
  const relief = ex.paye ? 0 : Math.min(KE_RATES.personalRelief, payeGross);
  const paye = r2(Math.max(0, payeGross - relief));
  const other = r2(i.deductions.reduce((s, d) => s + Number(d.amount || 0), 0) + Number(i.oneOffDeduction || 0));
  const totalDed = r2(nssf1 + nssf2 + shif + housing + paye + other);

  const earnings: Line[] = [{ name: 'Basic Salary', amount: Number(i.basic || 0) }, ...i.allowances.map((a) => ({ name: a.name, amount: Number(a.amount) }))];
  if (overtime) earnings.push({ name: 'Overtime', amount: overtime });
  if (bonus) earnings.push({ name: 'Bonus', amount: bonus });
  const deductions: Line[] = [
    { name: 'PAYE', amount: paye },
    { name: 'NSSF Tier I', amount: nssf1 },
    { name: 'NSSF Tier II', amount: nssf2 },
    { name: 'SHIF', amount: shif },
    { name: 'Housing Levy', amount: housing },
    ...i.deductions.map((d) => ({ name: d.name, amount: Number(d.amount) })),
  ];
  if (i.oneOffDeduction) deductions.push({ name: 'One-off Deduction', amount: Number(i.oneOffDeduction) });

  return {
    basic_salary: Number(i.basic || 0), total_allowances: allowances, bonus, overtime, gross_salary: gross,
    nssf_tier1: nssf1, nssf_tier2: nssf2, shif_amount: shif, housing_levy_amount: housing,
    taxable_pay: taxable, paye_before_relief: payeGross, personal_relief: relief, net_paye: paye,
    other_deductions: other, total_deductions: totalDed, net_salary: r2(gross - totalDed),
    employer_nssf: r2(nssf1 + nssf2), employer_housing_levy: housing,
    earnings_breakdown: earnings.filter((e) => e.amount), deductions_breakdown: deductions.filter((d) => d.amount),
  };
}

export const runStatusClass = (s: string) => ({
  draft: 'bg-warning/15 text-warning border-warning/30',
  approved: 'bg-info/15 text-info border-info/30',
  paid: 'bg-success/15 text-success border-success/30',
  cancelled: 'bg-muted text-muted-foreground border-border',
}[s] || 'bg-muted text-muted-foreground border-border');

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

export function payslipPdf(run: PayrollRun, item: PayrollItem, company = 'CONCEPT CLEANING SERVICES') {
  const doc = new jsPDF();
  const navy: [number, number, number] = [11, 61, 145];
  const emerald: [number, number, number] = [0, 166, 81];
  doc.setFillColor(...navy); doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text(company, 14, 14);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Nairobi, Kenya', 14, 21);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('PAYSLIP', 196, 14, { align: 'right' });
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(`${MONTHS[run.period_month - 1]} ${run.period_year}`, 196, 21, { align: 'right' });

  doc.setTextColor(30, 30, 30);
  autoTable(doc, {
    startY: 38, theme: 'plain', styles: { fontSize: 9, cellPadding: 1.2 },
    body: [
      ['Employee', item.employee_name || '', 'Payroll', run.payroll_code],
      ['Employee No.', item.employee_code || '', 'Pay date', run.pay_date || '—'],
      ['Department', item.department_name || '—', 'KRA PIN', item.kra_pin || '—'],
      ['Position', item.position_title || '—', 'Paid via', `${(item.payment_method || '').toUpperCase()} ${item.payment_account || ''}`],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 2: { fontStyle: 'bold', cellWidth: 25 } },
  });

  const earn = (item.earnings_breakdown as unknown as Line[]) || [];
  const ded = (item.deductions_breakdown as unknown as Line[]) || [];
  const n = Math.max(earn.length, ded.length);
  const body = Array.from({ length: n }, (_, i) => [
    earn[i]?.name || '', earn[i] ? kes(earn[i].amount) : '', ded[i]?.name || '', ded[i] ? kes(ded[i].amount) : '',
  ]);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 6,
    head: [['Earnings', 'Amount', 'Deductions', 'Amount']], body,
    foot: [['Gross Pay', kes(item.gross_salary), 'Total Deductions', kes(item.total_deductions)]],
    headStyles: { fillColor: navy }, footStyles: { fillColor: [240, 243, 248], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 9 }, columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
  });

  let y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFillColor(...emerald); doc.roundedRect(14, y, 182, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text('NET PAY', 20, y + 10); doc.text(kes(item.net_salary), 190, y + 10, { align: 'right' });

  y += 24;
  doc.setTextColor(90, 90, 90); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(`Taxable pay ${kes(item.taxable_pay)} · PAYE before relief ${kes(item.paye_before_relief)} · Personal relief ${kes(item.personal_relief)}`, 14, y);
  doc.text(`Employer contributions: NSSF ${kes(item.employer_nssf)} · Housing Levy ${kes(item.employer_housing_levy)}`, 14, y + 5);
  doc.text(`Status: ${run.status.toUpperCase()}${run.approved_at ? ` · Approved ${new Date(run.approved_at).toLocaleDateString('en-KE')}` : ''}`, 14, y + 10);
  doc.text(`Generated ${new Date().toLocaleString('en-KE')} · This is a system generated payslip.`, 14, 285);
  doc.save(`Payslip-${item.employee_code}-${run.payroll_code}.pdf`);
}
