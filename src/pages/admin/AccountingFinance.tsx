import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Banknote, BookOpen, Building2, CalendarDays,
  CheckCircle2, CircleDollarSign, ClipboardCheck, Download, FileText, Landmark,
  Plus, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, Wallet, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import ErpInvoices from '@/pages/admin/ErpInvoices';
import ErpIncome from '@/pages/admin/ErpIncome';
import ErpExpenses from '@/pages/admin/ErpExpenses';
import { downloadAccountingPdf } from '@/lib/accountingPdf';

type Row = Record<string, any>;
const db = (table: string) => (supabase as any).from(table);
const kes = (value: number) => 'KES ' + Number(value || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value?: string | null) => value ? new Date(value + (value.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-KE') : '—';
const today = new Date().toISOString().slice(0, 10);
const yearStart = new Date().getFullYear() + '-01-01';

const sections = [
  { id: 'overview', label: 'Financial Overview', description: 'A live view of posted ledger balances, approvals and financial activity' },
  { id: 'general-ledger', label: 'General Ledger', description: 'Chart of accounts, journals, double-entry posting and audit trail' },
  { id: 'sales-revenue', label: 'Sales & Revenue', description: 'Invoices, receipts, income and customer payments' },
  { id: 'expenses-purchases', label: 'Expenses & Purchases', description: 'Expense approvals, supplier costs and payment tracking' },
  { id: 'banking-cash', label: 'Banking & Cash', description: 'Cash, M-Pesa, bank accounts, petty cash and reconciliations' },
  { id: 'accounts-receivable', label: 'Accounts Receivable', description: 'Customer invoices, receipts and outstanding balances' },
  { id: 'accounts-payable', label: 'Accounts Payable', description: 'Approved supplier and operating expenses awaiting payment' },
  { id: 'assets-depreciation', label: 'Assets & Depreciation', description: 'Fixed asset register, useful lives and depreciation schedules' },
  { id: 'budgets-planning', label: 'Budgets & Planning', description: 'Annual budgets, monthly allocations and actual-versus-budget control' },
  { id: 'financial-reports', label: 'Financial Reports', description: 'Trial balance, income statement, balance sheet and cash flow' },
  { id: 'tax-compliance', label: 'Tax & Compliance', description: 'Configurable tax records and compliance settings' },
  { id: 'accounting-periods', label: 'Accounting Periods', description: 'Monthly periods, financial years and controlled closing' },
  { id: 'accounting-settings', label: 'Accounting Settings', description: 'Chart of accounts, currency and accounting controls' },
  { id: 'approvals', label: 'Accounting Approvals', description: 'Maker-checker review of accounting submissions' },
] as const;

const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const money = (value: any) => Number(value || 0);

function PageTitle({ title, description, onExport, onRefresh }: {
  title: string; description: string; onExport?: () => void; onRefresh?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/admin" className="hover:underline">Admin</Link><span>/</span>
          <Link to="/admin/accounting/overview" className="hover:underline">Accounting & Finance</Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        {onRefresh && <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>}
        {onExport && <Button size="sm" onClick={onExport}><Download className="mr-2 h-4 w-4" />Export PDF</Button>}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, note }: { label: string; value: string; icon: any; note?: string }) {
  return (
    <Card>
      <CardContent className="flex min-w-0 items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-bold tabular-nums">{value}</p>
          {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Empty({ children = 'No records found for this selection.' }: { children?: ReactNode }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export default function AccountingFinance() {
  const { section = 'overview' } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const active = sections.find((item) => item.id === section) || sections[0];
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Row>({});
  const [fromDate, setFromDate] = useState(yearStart);
  const [toDate, setToDate] = useState(today);
  const [reportType, setReportType] = useState('trial_balance');
  const [approvalTarget, setApprovalTarget] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  // General ledger journal composer
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalForm, setJournalForm] = useState({ date: today, period_id: '', description: '', reference: '' });
  const [journalLines, setJournalLines] = useState<Row[]>([
    { account_id: '', debit: '', credit: '', description: '' },
    { account_id: '', debit: '', credit: '', description: '' },
  ]);

  // Banking and cash
  const [bankOpen, setBankOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ account_id: '', bank_name: '', account_name: '', account_number_masked: '', branch_name: '', opening_balance: '0', opening_balance_date: today });
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementForm, setMovementForm] = useState({ fund_id: '', date: today, type: 'replenishment', amount: '', description: '', reference: '', source_account_id: '' });

  // Accounts payable
  const [payExpense, setPayExpense] = useState<Row | null>(null);
  const [payForm, setPayForm] = useState({ method: 'cash', reference: '', date: today });

  // Fixed assets
  const [assetOpen, setAssetOpen] = useState(false);
  const [depreciationAsset, setDepreciationAsset] = useState<Row | null>(null);
  const [depreciationPeriodId, setDepreciationPeriodId] = useState('');
  const [payAsset, setPayAsset] = useState<Row | null>(null);
  const [assetPayForm, setAssetPayForm] = useState({ method: 'cash', reference: '', date: today });
  const [assetForm, setAssetForm] = useState({
    asset_code: '', name: '', category: 'equipment', purchase_date: today, purchase_cost: '',
    residual_value: '0', useful_life_months: '60', depreciation_method: 'straight_line',
    asset_account_id: '', depreciation_expense_account_id: '', accumulated_depreciation_account_id: '',
    source_expense_id: '', description: '',
  });

  // Budgets
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ name: '', financial_year_id: '', notes: '' });
  const [budgetLineOpen, setBudgetLineOpen] = useState<Row | null>(null);
  const [budgetLine, setBudgetLine] = useState({ account_id: '', period_id: '', amount: '0', notes: '' });

  // Tax / accounting settings
  const [settingsForm, setSettingsForm] = useState({ vat_registered: false, vat_rate: '0', tax_registration_notes: '', currency_code: 'KES' });
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ code: '', name: '', account_type: 'expense', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const result: Row = {};
    try {
      if (section === 'overview') {
        const [entries, accounts, approvals, invoices, expenses] = await Promise.all([
          db('journal_entries').select('id,entry_date,period_id,description').eq('status', 'posted').gte('entry_date', fromDate).lte('entry_date', toDate).order('entry_date', { ascending: false }).limit(5000),
          db('accounting_accounts').select('id,code,name,account_type,is_active').eq('is_active', true).order('code'),
          db('accounting_approvals').select('id,entity_type,entity_id,submitted_by,submitted_at').eq('status', 'pending_approval').order('submitted_at', { ascending: false }),
          db('invoices').select('id,amount,payment_status').not('payment_status', 'in', '("cancelled","void")'),
          db('expenses').select('id,amount,approval_status,paid_at'),
        ]);
        const ids = (entries.data || []).map((r: Row) => r.id);
        const lines = ids.length ? await db('journal_lines').select('journal_entry_id,account_id,debit,credit').in('journal_entry_id', ids) : { data: [], error: null };
        result.entries = entries.data || [];
        result.accounts = accounts.data || [];
        result.lines = lines.data || [];
        result.approvals = approvals.data || [];
        result.invoices = invoices.data || [];
        result.expenses = expenses.data || [];
      } else if (section === 'general-ledger') {
        const [entries, accounts, periods, approvals] = await Promise.all([
          db('journal_entries').select('*').order('entry_date', { ascending: false }).limit(500),
          db('accounting_accounts').select('*').order('code'),
          db('accounting_periods').select('*').order('starts_on', { ascending: false }),
          db('accounting_approvals').select('id,entity_id,status').eq('entity_type', 'journal').eq('status', 'pending_approval'),
        ]);
        result.entries = entries.data || []; result.accounts = accounts.data || [];
        result.periods = periods.data || []; result.approvals = approvals.data || [];
      } else if (section === 'banking-cash') {
        const [banks, funds, balances, accounts, transactions] = await Promise.all([
          db('accounting_bank_accounts').select('*,accounting_accounts(code,name)').order('bank_name'),
          db('petty_cash_funds').select('*').order('name'),
          db('petty_cash_fund_balances').select('*').order('name'),
          db('accounting_accounts').select('id,code,name,account_type').eq('is_active', true).order('code'),
          db('petty_cash_transactions').select('*').order('transaction_date', { ascending: false }).limit(200),
        ]);
        result.banks = banks.data || []; result.funds = funds.data || []; result.balances = balances.data || [];
        result.accounts = accounts.data || []; result.transactions = transactions.data || [];
      } else if (section === 'accounts-receivable') {
        const [invoices, payments] = await Promise.all([
          db('invoices').select('*').order('date', { ascending: false }).limit(1000),
          db('invoice_payments').select('invoice_id,amount,payment_date,payment_method,payment_reference,approval_status').order('payment_date', { ascending: false }),
        ]);
        result.invoices = invoices.data || []; result.payments = payments.data || [];
      } else if (section === 'accounts-payable') {
        const [expenses, payroll, assets] = await Promise.all([
          db('expenses').select('*').order('date', { ascending: false }).limit(1000),
          db('payroll_runs').select('id,payroll_code,period_month,period_year,total_net,status,payment_reference,pay_date').order('period_year', { ascending: false }).limit(100),
          db('accounting_fixed_assets').select('*').eq('status','approved').is('source_expense_id',null).order('purchase_date',{ascending:false}),
        ]);
        result.expenses = expenses.data || []; result.payroll = payroll.data || []; result.assets = assets.data || [];
      } else if (section === 'assets-depreciation') {
        const [assets, schedules, accounts, periods, expenses] = await Promise.all([
          db('accounting_fixed_assets').select('*').order('purchase_date', { ascending: false }),
          db('accounting_asset_depreciation').select('*').order('depreciation_date', { ascending: false }),
          db('accounting_accounts').select('id,code,name,account_type').eq('is_active', true).order('code'),
          db('accounting_periods').select('id,name,starts_on,ends_on,status').order('starts_on', { ascending: false }),
          db('expenses').select('id,date,amount,category,description,approval_status').eq('approval_status','approved').order('date',{ascending:false}),
        ]);
        result.assets = assets.data || []; result.schedules = schedules.data || [];
        result.accounts = accounts.data || []; result.periods = periods.data || []; result.expenses = expenses.data || [];
      } else if (section === 'budgets-planning') {
        const [budgets, years, periods, accounts, lines] = await Promise.all([
          db('accounting_budgets').select('*').order('created_at', { ascending: false }),
          db('accounting_financial_years').select('*').order('starts_on', { ascending: false }),
          db('accounting_periods').select('id,name,starts_on,ends_on,financial_year_id').order('starts_on'),
          db('accounting_accounts').select('id,code,name,account_type').eq('is_active', true).order('code'),
          db('accounting_budget_lines').select('*'),
        ]);
        result.budgets = budgets.data || []; result.years = years.data || []; result.periods = periods.data || [];
        result.accounts = accounts.data || []; result.lines = lines.data || [];
      } else if (section === 'financial-reports') {
        const [entries, accounts] = await Promise.all([
          db('journal_entries').select('id,entry_date,entry_number,description').eq('status', 'posted').gte('entry_date', fromDate).lte('entry_date', toDate).order('entry_date'),
          db('accounting_accounts').select('id,code,name,account_type').eq('is_active', true).order('code'),
        ]);
        const ids = (entries.data || []).map((r: Row) => r.id);
        const lines = ids.length ? await db('journal_lines').select('journal_entry_id,account_id,debit,credit,description').in('journal_entry_id', ids) : { data: [], error: null };
        result.entries = entries.data || []; result.accounts = accounts.data || []; result.lines = lines.data || [];
      } else if (section === 'tax-compliance' || section === 'accounting-settings') {
        const [settings, accounts] = await Promise.all([
          db('accounting_settings').select('*').eq('is_default', true).maybeSingle(),
          db('accounting_accounts').select('*').order('code'),
        ]);
        result.settings = settings.data || null; result.accounts = accounts.data || [];
      } else if (section === 'accounting-periods') {
        const [years, periods] = await Promise.all([
          db('accounting_financial_years').select('*').order('starts_on', { ascending: false }),
          db('accounting_periods').select('*').order('starts_on', { ascending: false }),
        ]);
        result.years = years.data || []; result.periods = periods.data || [];
      } else if (section === 'approvals') {
        const { data: approvals, error } = await db('accounting_approvals').select('*').eq('status', 'pending_approval').order('submitted_at', { ascending: true });
        if (error) throw error;
        const enriched = await Promise.all((approvals || []).map(async (approval: Row) => {
          const sourceTable: Record<string, string> = {
            income: 'income_records', expense: 'expenses', invoice: 'invoices',
            journal: 'journal_entries', petty_cash: 'petty_cash_transactions', payroll: 'payroll_runs',
            asset: 'accounting_fixed_assets', budget: 'accounting_budgets',
            bank_reconciliation: 'accounting_bank_reconciliations',
          };
          const table = sourceTable[approval.entity_type];
          if (!table) return { ...approval, detail: null };
          const { data: detail } = await db(table).select('*').eq('id', approval.entity_id).maybeSingle();
          return { ...approval, detail };
        }));
        result.approvals = enriched;
      }
      setData(result);
    } catch (error: any) {
      toast.error(error?.message || 'Could not load accounting data');
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [section, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (data.settings) {
      setSettingsForm({
        vat_registered: !!data.settings.vat_registered,
        vat_rate: String(data.settings.vat_rate ?? 0),
        tax_registration_notes: data.settings.tax_registration_notes || '',
        currency_code: data.settings.currency_code || 'KES',
      });
    }
  }, [data.settings]);

  const accountById = useMemo(() => new Map((data.accounts || []).map((a: Row) => [a.id, a])), [data.accounts]);
  const reportRows = useMemo(() => {
    const totals = new Map<string, Row>();
    (data.lines || []).forEach((line: Row) => {
      const account = accountById.get(line.account_id) as Row | undefined;
      if (!account) return;
      const current = totals.get(line.account_id) || { account_id: line.account_id, code: account.code, name: account.name, account_type: account.account_type, debit: 0, credit: 0 };
      current.debit += money(line.debit); current.credit += money(line.credit);
      totals.set(line.account_id, current);
    });
    return Array.from(totals.values()).map((row) => ({ ...row, balance: ['liability','equity','revenue'].includes(row.account_type) ? row.credit - row.debit : row.debit - row.credit }));
  }, [data.lines, accountById]);

  const overview = useMemo(() => {
    const balanceFor = (codes: string[]) => reportRows.filter((r: Row) => codes.includes(r.code)).reduce((sum: number, r: Row) => sum + r.balance, 0);
    const income = reportRows.filter((r: Row) => r.account_type === 'revenue').reduce((s: number, r: Row) => s + r.balance, 0);
    const expense = reportRows.filter((r: Row) => r.account_type === 'expense').reduce((s: number, r: Row) => s + r.balance, 0);
    const cash = balanceFor(['1000','1010','1020','1030']);
    const receivable = balanceFor(['1100']);
    const payable = balanceFor(['2000','2100','2300','2310','2320','2330','2340']);
    return { cash, receivable, payable, income, expense, profit: income - expense };
  }, [reportRows]);

  const exportRows = (title: string, columns: string[], rows: any[][], totals?: string[]) => {
    downloadAccountingPdf({
      title,
      period: fromDate + ' to ' + toDate,
      columns,
      rows,
      totals,
      filters: ['Date range: ' + fromDate + ' — ' + toDate, 'Currency: KES'],
    });
  };

  const approve = async (approval: Row, decision: 'approved' | 'rejected', note?: string) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc('accounting_decide_approval', {
      p_approval_id: approval.id, p_decision: decision, p_note: note || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(decision === 'approved' ? 'Submission approved and processed' : 'Submission rejected');
    setApprovalTarget(null); setRejectReason('');
    await load();
  };

  const saveJournal = async () => {
    if (!user) return;
    const valid = journalLines.filter((line) => line.account_id && (money(line.debit) > 0 || money(line.credit) > 0));
    const debit = valid.reduce((sum, line) => sum + money(line.debit), 0);
    const credit = valid.reduce((sum, line) => sum + money(line.credit), 0);
    if (!journalForm.period_id || !journalForm.description.trim() || valid.length < 2 || debit <= 0 || debit !== credit) {
      toast.error('Select a period, enter a description and provide at least two balanced journal lines.');
      return;
    }
    setBusy(true);
    try {
      const { data: number, error: numberError } = await (supabase as any).rpc('accounting_next_entry_number');
      if (numberError) throw numberError;
      const { data: entry, error: entryError } = await db('journal_entries').insert({
        entry_number: number, entry_date: journalForm.date, description: journalForm.description.trim(),
        reference: journalForm.reference.trim() || null, status: 'draft', period_id: journalForm.period_id,
        created_by: user.id, approval_status: 'not_submitted',
      }).select('id').single();
      if (entryError) throw entryError;
      const { error: linesError } = await db('journal_lines').insert(valid.map((line, index) => ({
        journal_entry_id: entry.id, line_number: index + 1, account_id: line.account_id,
        debit: money(line.debit), credit: money(line.credit), description: line.description || null,
      })));
      if (linesError) {
        await db('journal_entries').delete().eq('id', entry.id);
        throw linesError;
      }
      const { error: submitError } = await db('journal_entries').update({ approval_status: 'pending_approval' }).eq('id', entry.id);
      if (submitError) throw submitError;
      toast.success('Journal submitted for independent approval');
      setJournalOpen(false);
      setJournalForm({ date: today, period_id: '', description: '', reference: '' });
      setJournalLines([{ account_id: '', debit: '', credit: '', description: '' }, { account_id: '', debit: '', credit: '', description: '' }]);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Could not save journal');
    } finally { setBusy(false); }
  };

  const postJournal = async (id: string) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc('accounting_post_journal', { p_journal_id: id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Journal posted to the general ledger');
    load();
  };

  const saveBankAccount = async () => {
    if (!bankForm.account_id || !bankForm.bank_name.trim() || !bankForm.account_name.trim()) return toast.error('Choose the ledger account and enter the bank and account names.');
    const { error } = await db('accounting_bank_accounts').insert({
      ...bankForm, opening_balance: money(bankForm.opening_balance), created_by: user?.id || null,
    });
    if (error) return toast.error(error.message);
    toast.success('Bank account added'); setBankOpen(false); load();
  };

  const saveMovement = async () => {
    if (!movementForm.fund_id || !movementForm.source_account_id || money(movementForm.amount) <= 0) return toast.error('Choose a petty-cash fund and enter a valid amount.');
    const { error } = await (supabase as any).rpc('accounting_record_petty_cash_movement', {
      p_fund_id: movementForm.fund_id, p_date: movementForm.date, p_type: movementForm.type,
      p_amount: money(movementForm.amount), p_description: movementForm.description || movementForm.type,
      p_reference: movementForm.reference || null, p_source_account_id: movementForm.source_account_id,
    });
    if (error) return toast.error(error.message);
    toast.success('Petty-cash movement submitted for approval'); setMovementOpen(false); load();
  };

  const payApprovedExpense = async () => {
    if (!payExpense) return;
    const { error } = await (supabase as any).rpc('accounting_record_expense_payment', {
      p_expense_id: payExpense.id, p_payment_method: payForm.method,
      p_payment_reference: payForm.reference || null, p_payment_date: payForm.date,
    });
    if (error) return toast.error(error.message);
    toast.success('Expense payment recorded and posted to the ledger');
    setPayExpense(null); setPayForm({ method: 'cash', reference: '', date: today }); load();
  };

  const saveAsset = async () => {
    if (!assetForm.asset_code.trim() || !assetForm.name.trim() || money(assetForm.purchase_cost) <= 0 || !assetForm.asset_account_id || (assetForm.depreciation_method !== 'none' && (!assetForm.depreciation_expense_account_id || !assetForm.accumulated_depreciation_account_id))) {
      return toast.error('Enter an asset code, name, positive cost and asset account.');
    }
    const { error } = await db('accounting_fixed_assets').insert({
      ...assetForm, source_expense_id: assetForm.source_expense_id || null, purchase_cost: money(assetForm.purchase_cost), residual_value: money(assetForm.residual_value),
      useful_life_months: assetForm.depreciation_method === 'none' ? null : Number(assetForm.useful_life_months),
      created_by: user?.id || null, status: 'pending_approval',
    });
    if (error) return toast.error(error.message);
    toast.success('Asset submitted for approval'); setAssetOpen(false); load();
  };

  const generateDepreciation = async () => {
    if (!depreciationAsset || !depreciationPeriodId) return toast.error('Select an open accounting period.');
    const { error } = await (supabase as any).rpc('accounting_generate_depreciation', {
      p_asset_id: depreciationAsset.id, p_period_id: depreciationPeriodId,
    });
    if (error) return toast.error(error.message);
    toast.success('Depreciation submitted for independent approval');
    setDepreciationAsset(null); setDepreciationPeriodId(''); load();
  };

  const payApprovedAsset = async () => {
    if (!payAsset) return;
    const { error } = await (supabase as any).rpc('accounting_record_asset_payment', {
      p_asset_id: payAsset.id, p_payment_method: assetPayForm.method,
      p_payment_reference: assetPayForm.reference || null, p_payment_date: assetPayForm.date,
    });
    if (error) return toast.error(error.message);
    toast.success('Fixed asset payment recorded and posted');
    setPayAsset(null); setAssetPayForm({ method: 'cash', reference: '', date: today }); load();
  };

  const saveBudget = async () => {
    if (!budgetForm.name.trim() || !budgetForm.financial_year_id) return toast.error('Enter a budget name and select a financial year.');
    const { data: budget, error } = await db('accounting_budgets').insert({
      ...budgetForm, created_by: user?.id || null, status: 'draft',
    }).select('id').single();
    if (error) return toast.error(error.message);
    toast.success('Budget created'); setBudgetOpen(false);
    setBudgetLineOpen({ id: budget.id, name: budgetForm.name });
    setBudgetForm({ name: '', financial_year_id: '', notes: '' }); load();
  };

  const saveBudgetLine = async () => {
    if (!budgetLineOpen || !budgetLine.account_id || !budgetLine.period_id || money(budgetLine.amount) < 0) return toast.error('Choose an account and month, then enter a valid budget amount.');
    const { error } = await db('accounting_budget_lines').upsert({
      budget_id: budgetLineOpen.id, account_id: budgetLine.account_id, period_id: budgetLine.period_id,
      amount: money(budgetLine.amount), notes: budgetLine.notes || null,
    }, { onConflict: 'budget_id,account_id,period_id' });
    if (error) return toast.error(error.message);
    toast.success('Budget allocation saved'); setBudgetLineOpen(null); load();
  };

  const submitBudget = async (budget: Row) => {
    const { error } = await db('accounting_budgets').update({ status: 'pending_approval' }).eq('id', budget.id).eq('status', 'draft');
    if (error) return toast.error(error.message);
    toast.success('Budget submitted for approval'); load();
  };

  const saveTaxSettings = async () => {
    const { error } = await db('accounting_settings').update({
      vat_registered: settingsForm.vat_registered,
      vat_rate: settingsForm.vat_registered ? money(settingsForm.vat_rate) : 0,
      tax_registration_notes: settingsForm.tax_registration_notes || null,
      currency_code: settingsForm.currency_code || 'KES',
      updated_by: user?.id || null, updated_at: new Date().toISOString(),
    }).eq('is_default', true);
    if (error) return toast.error(error.message);
    toast.success('Accounting settings saved'); load();
  };

  const addAccount = async () => {
    if (!accountForm.code.trim() || !accountForm.name.trim()) return toast.error('Account code and name are required.');
    const { error } = await db('accounting_accounts').insert({
      ...accountForm, is_active: true, is_system_account: false, is_control_account: false, created_by: user?.id || null,
    });
    if (error) return toast.error(error.message);
    toast.success('Ledger account added'); setAccountOpen(false); setAccountForm({ code: '', name: '', account_type: 'expense', description: '' }); load();
  };

  const closePeriod = async (period: Row) => {
    if (!window.confirm('Close ' + period.name + '? Closed periods cannot be reopened.')) return;
    const { error } = await (supabase as any).rpc('accounting_close_period', { p_period_id: period.id });
    if (error) return toast.error(error.message);
    toast.success(period.name + ' closed'); load();
  };

  const closeYear = async (year: Row) => {
    if (!window.confirm('Close ' + year.name + '? This requires all monthly periods to be closed.')) return;
    const { error } = await (supabase as any).rpc('accounting_close_financial_year', { p_year_id: year.id });
    if (error) return toast.error(error.message);
    toast.success(year.name + ' closed'); load();
  };

  const exportOverview = () => exportRows('Financial Overview', ['Account', 'Debit', 'Credit', 'Balance'], reportRows.map((r: Row) => [r.code + ' ' + r.name, kes(r.debit), kes(r.credit), kes(r.balance)]));
  const exportLedger = () => exportRows('General Ledger', ['Entry No.', 'Date', 'Description', 'Status', 'Approval'], (data.entries || []).map((r: Row) => [String(r.entry_number), dateLabel(r.entry_date), r.description, r.status, r.approval_status]));
  const exportApprovals = () => exportRows('Accounting Approvals', ['Type', 'Record ID', 'Submitted', 'Submitted By'], (data.approvals || []).map((r: Row) => [r.entity_type, r.entity_id, dateLabel(r.submitted_at), r.submitted_by]));
  const exportAr = () => exportRows('Accounts Receivable', ['Invoice', 'Client', 'Date', 'Amount', 'Paid', 'Outstanding', 'Status'], (data.invoices || []).map((r: Row) => {
    const paid = (data.payments || []).filter((p: Row) => p.invoice_id === r.id && p.approval_status === 'approved').reduce((s: number, p: Row) => s + money(p.amount), 0);
    return [r.invoice_number, r.client_name, dateLabel(r.date), kes(r.amount), kes(paid), kes(Math.max(0, money(r.amount) - paid)), r.payment_status];
  }));
  const exportAp = () => exportRows('Accounts Payable', ['Type','Date','Description','Amount','Approval','Payment'], [...(data.expenses || []).filter((r: Row) => r.approval_status === 'approved').map((r: Row) => ['Expense',dateLabel(r.date),r.description || r.category,kes(r.amount),r.approval_status,r.paid_at ? 'Paid' : 'Unpaid']), ...(data.assets || []).map((r: Row) => ['Fixed asset',dateLabel(r.purchase_date),r.name,kes(r.purchase_cost),r.status,r.paid_at ? 'Paid' : 'Unpaid'])]);
  const exportAssets = () => exportRows('Fixed Asset Register', ['Code', 'Asset', 'Purchase Date', 'Cost', 'Accumulated Depreciation', 'Net Book Value', 'Payment', 'Status'], (data.assets || []).map((r: Row) => [r.asset_code, r.name, dateLabel(r.purchase_date), kes(r.purchase_cost), kes(r.accumulated_depreciation), kes(money(r.purchase_cost) - money(r.accumulated_depreciation)), r.paid_at ? 'Paid' : 'Unpaid', r.status]));
  const exportBudgets = () => exportRows('Budgets & Planning', ['Budget', 'Financial Year', 'Status', 'Allocations'], (data.budgets || []).map((r: Row) => [r.name, (data.years || []).find((y: Row) => y.id === r.financial_year_id)?.name || '', r.status, kes((data.lines || []).filter((l: Row) => l.budget_id === r.id).reduce((s: number, l: Row) => s + money(l.amount), 0))]));
  const exportBanking = () => exportRows('Banking & Cash', ['Account', 'Bank', 'Account Name', 'Masked Number', 'Opening Balance', 'Status'], (data.banks || []).map((r: Row) => [r.accounting_accounts?.code || '', r.bank_name, r.account_name, r.account_number_masked, kes(r.opening_balance), r.is_active ? 'Active' : 'Inactive']));
  const exportPeriods = () => exportRows('Accounting Periods', ['Financial Year', 'Period', 'Start', 'End', 'Status'], (data.periods || []).map((r: Row) => [(data.years || []).find((y: Row) => y.id === r.financial_year_id)?.name || '', r.name, dateLabel(r.starts_on), dateLabel(r.ends_on), r.status]));

  const reports = useMemo(() => {
    const rows = reportRows;
    if (reportType === 'profit_loss') return rows.filter((r: Row) => ['revenue','expense'].includes(r.account_type));
    if (reportType === 'balance_sheet') return rows.filter((r: Row) => ['asset','liability','equity'].includes(r.account_type));
    if (reportType === 'cash_flow') return rows.filter((r: Row) => ['1000','1010','1020','1030'].includes(r.code));
    return rows;
  }, [reportRows, reportType]);

  const exportReports = () => exportRows(
    reportType === 'profit_loss' ? 'Income Statement' : reportType === 'balance_sheet' ? 'Balance Sheet' : reportType === 'cash_flow' ? 'Cash Flow Summary' : 'Trial Balance',
    ['Code','Account','Type','Debit','Credit','Net Balance'],
    reports.map((r: Row) => [r.code,r.name,r.account_type,kes(r.debit),kes(r.credit),kes(r.balance)])
  );

  const setLine = (index: number, key: string, value: any) => setJournalLines((current) => current.map((line, i) => i === index ? { ...line, [key]: value } : line));
  const addLine = () => setJournalLines((current) => [...current, { account_id: '', debit: '', credit: '', description: '' }]);

  const exportCurrent = () => {
    if (section === 'overview') return exportOverview();
    if (section === 'general-ledger') return exportLedger();
    if (section === 'approvals') return exportApprovals();
    if (section === 'accounts-receivable') return exportAr();
    if (section === 'accounts-payable') return exportAp();
    if (section === 'assets-depreciation') return exportAssets();
    if (section === 'budgets-planning') return exportBudgets();
    if (section === 'banking-cash') return exportBanking();
    if (section === 'accounting-periods') return exportPeriods();
    if (section === 'financial-reports') return exportReports();
    if (section === 'tax-compliance') return exportRows('Tax & Compliance', ['Setting','Value'], [['VAT registered',settingsForm.vat_registered ? 'Yes' : 'No'],['VAT rate',settingsForm.vat_registered ? settingsForm.vat_rate + '%' : 'Disabled'],['Currency',settingsForm.currency_code],['Notes',settingsForm.tax_registration_notes || '—']]);
    if (section === 'accounting-settings') return exportRows('Accounting Settings', ['Code','Account','Type','System','Status'], accounts.map((a: Row) => [a.code,a.name,a.account_type,a.is_system_account ? 'Protected' : 'No',a.is_active ? 'Active' : 'Inactive']));
    return exportRows(active.label, ['Name','Status'], []);
  };

  const heading = section === 'overview' ? 'Financial Overview' : active.label;
  const accounts = data.accounts || [];
  const openPeriods = (data.periods || []).filter((p: Row) => p.status === 'open');
  const reportTotals = reports.reduce((acc: Row, row: Row) => {
    acc.debit += money(row.debit); acc.credit += money(row.credit); return acc;
  }, { debit: 0, credit: 0 });

  if (section === 'sales-revenue') {
    return <div className="space-y-6"><PageTitle title={active.label} description={active.description} onRefresh={load} />
      <div className="grid gap-6 xl:grid-cols-2"><div className="min-w-0"><ErpInvoices /></div><div className="min-w-0"><ErpIncome /></div></div>
    </div>;
  }
  if (section === 'expenses-purchases') {
    return <div className="space-y-6"><PageTitle title={active.label} description={active.description} onRefresh={load} /><ErpExpenses /></div>;
  }

  return (
    <div className="space-y-6">
      <PageTitle title={heading} description={active.description} onExport={exportCurrent} onRefresh={load} />

      {(section === 'overview' || section === 'financial-reports') && (
        <Card><CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div><Label className="text-xs">From</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" /></div>
          {section === 'financial-reports' && <div className="min-w-48"><Label className="text-xs">Report</Label>
            <Select value={reportType} onValueChange={setReportType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="trial_balance">Trial Balance</SelectItem><SelectItem value="profit_loss">Income Statement</SelectItem><SelectItem value="balance_sheet">Balance Sheet</SelectItem><SelectItem value="cash_flow">Cash Flow Summary</SelectItem>
            </SelectContent></Select></div>}
          <p className="text-xs text-muted-foreground">Figures are calculated from posted double-entry journals only.</p>
        </CardContent></Card>
      )}

      {loading ? <div className="flex justify-center p-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" /></div> : null}

      {!loading && section === 'overview' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Cash & Bank" value={kes(overview.cash)} icon={Wallet} note="Posted ledger balances" />
            <Stat label="Accounts Receivable" value={kes(overview.receivable)} icon={FileText} />
            <Stat label="Accounts Payable" value={kes(overview.payable)} icon={Building2} />
            <Stat label="Revenue" value={kes(overview.income)} icon={TrendingUp} />
            <Stat label="Expenses" value={kes(overview.expense)} icon={TrendingDown} />
            <Stat label="Net Operating Result" value={kes(overview.profit)} icon={CircleDollarSign} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card><CardHeader><CardTitle className="text-base">Ledger balances</CardTitle></CardHeader><CardContent className="p-0">
              <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
                <TableBody>{reportRows.length ? reportRows.map((r: Row) => <TableRow key={r.account_id}><TableCell><span className="font-mono text-xs">{r.code}</span> {r.name}</TableCell><TableCell className="capitalize">{r.account_type}</TableCell><TableCell className="text-right tabular-nums">{kes(r.debit)}</TableCell><TableCell className="text-right tabular-nums">{kes(r.credit)}</TableCell><TableCell className="text-right font-medium tabular-nums">{kes(r.balance)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5}><Empty>No posted journals yet. Approved source transactions will begin populating the ledger.</Empty></TableCell></TableRow>}</TableBody>
              </Table></div>
            </CardContent></Card>
            <div className="space-y-4">
              <Card><CardHeader><CardTitle className="flex items-center justify-between text-base">Pending approvals <Badge variant="secondary">{(data.approvals || []).length}</Badge></CardTitle></CardHeader><CardContent className="space-y-3">
                {(data.approvals || []).slice(0, 6).map((a: Row) => <div key={a.id} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0"><div className="min-w-0"><p className="text-sm font-medium capitalize">{a.entity_type.replace(/_/g, ' ')}</p><p className="truncate text-xs text-muted-foreground">{dateLabel(a.submitted_at)}</p></div><Button size="sm" variant="outline" onClick={() => navigate('/admin/accounting/approvals')}>Review</Button></div>)}
                {!(data.approvals || []).length && <Empty>No pending accounting approvals.</Empty>}
                <Button asChild variant="outline" className="w-full"><Link to="/admin/accounting/approvals">Open approval queue <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-base">Operational items not yet posted</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Invoices awaiting approval</span><strong>{(data.invoices || []).filter((r: Row) => r.payment_status === 'pending_approval').length}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Approved invoices</span><strong>{(data.invoices || []).filter((r: Row) => ['approved','partial','paid'].includes(r.payment_status)).length}</strong></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Expenses awaiting approval</span><strong>{(data.expenses || []).filter((r: Row) => r.approval_status === 'pending_approval').length}</strong></div>
                <p className="text-xs text-muted-foreground">These are workflow counts, not ledger balances. Approval and payment are tracked separately.</p>
              </CardContent></Card>
            </div>
          </div>
        </>
      )}

      {!loading && section === 'general-ledger' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm text-muted-foreground">Create journals in draft, submit for independent approval, then post.</div><Button onClick={() => setJournalOpen(true)}><Plus className="mr-2 h-4 w-4" />New Journal</Button></div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Entry</TableHead><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead>Approval</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
            {(data.entries || []).map((r: Row) => <TableRow key={r.id}><TableCell className="font-mono">JE-{r.entry_number}</TableCell><TableCell>{dateLabel(r.entry_date)}</TableCell><TableCell className="min-w-48">{r.description}</TableCell><TableCell><Badge variant={r.status === 'posted' ? 'default' : 'outline'}>{r.status}</Badge></TableCell><TableCell><Badge variant={r.approval_status === 'approved' ? 'default' : r.approval_status === 'rejected' ? 'destructive' : 'secondary'}>{r.approval_status}</Badge></TableCell><TableCell className="text-right">{r.status === 'draft' && r.approval_status === 'approved' ? <Button size="sm" onClick={() => postJournal(r.id)} disabled={busy}>Post journal</Button> : r.status === 'draft' && r.approval_status === 'pending_approval' ? <span className="text-xs text-muted-foreground">Awaiting review</span> : '—'}</TableCell></TableRow>)}
            {!(data.entries || []).length && <TableRow><TableCell colSpan={6}><Empty>No journal entries yet.</Empty></TableCell></TableRow>}
          </TableBody></Table></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Chart of accounts</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{accounts.map((a: Row) => <TableRow key={a.id}><TableCell className="font-mono">{a.code}</TableCell><TableCell>{a.name}</TableCell><TableCell className="capitalize">{a.account_type}</TableCell><TableCell>{a.is_active ? 'Active' : 'Inactive'}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
        </>
      )}

      {!loading && section === 'banking-cash' && (
        <>
          <div className="flex flex-wrap gap-2"><Button onClick={() => setBankOpen(true)}><Plus className="mr-2 h-4 w-4" />Add bank account</Button><Button variant="outline" onClick={() => setMovementOpen(true)}><Banknote className="mr-2 h-4 w-4" />Petty-cash movement</Button></div>
          <Card><CardHeader><CardTitle className="text-base">Bank accounts</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Ledger</TableHead><TableHead>Bank</TableHead><TableHead>Account Name</TableHead><TableHead>Masked Number</TableHead><TableHead className="text-right">Opening Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(data.banks || []).map((b: Row) => <TableRow key={b.id}><TableCell>{b.accounting_accounts?.code} · {b.accounting_accounts?.name}</TableCell><TableCell>{b.bank_name}</TableCell><TableCell>{b.account_name}</TableCell><TableCell className="font-mono">{b.account_number_masked || '—'}</TableCell><TableCell className="text-right">{kes(b.opening_balance)}</TableCell><TableCell>{b.is_active ? 'Active' : 'Inactive'}</TableCell></TableRow>)}{!(data.banks || []).length && <TableRow><TableCell colSpan={6}><Empty>No bank accounts configured yet.</Empty></TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Petty cash funds</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Fund</TableHead><TableHead>Custodian</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Current Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(data.balances || []).map((b: Row) => <TableRow key={b.fund_id}><TableCell>{b.name}</TableCell><TableCell>{(data.funds || []).find((f: Row) => f.id === b.fund_id)?.custodian_id || '—'}</TableCell><TableCell className="text-right">{kes((data.funds || []).find((f: Row) => f.id === b.fund_id)?.opening_balance)}</TableCell><TableCell className="text-right font-semibold">{kes(b.current_balance)}</TableCell><TableCell>{b.is_active ? 'Active' : 'Inactive'}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Recent petty-cash activity</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(data.transactions || []).map((t: Row) => <TableRow key={t.id}><TableCell>{dateLabel(t.transaction_date)}</TableCell><TableCell className="capitalize">{t.transaction_type.replace(/_/g, ' ')}</TableCell><TableCell>{t.description}</TableCell><TableCell className="text-right">{kes(t.amount)}</TableCell><TableCell><Badge variant={t.status === 'approved' ? 'default' : t.status === 'rejected' ? 'destructive' : 'secondary'}>{t.status}</Badge></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
        </>
      )}

      {!loading && section === 'accounts-receivable' && (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Client</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Invoice Amount</TableHead><TableHead className="text-right">Approved Payments</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
          {(data.invoices || []).filter((r: Row) => !['cancelled','void','rejected'].includes(r.payment_status)).map((r: Row) => {
            const paid = (data.payments || []).filter((p: Row) => p.invoice_id === r.id && p.approval_status === 'approved').reduce((s: number, p: Row) => s + money(p.amount), 0);
            return <TableRow key={r.id}><TableCell className="font-mono">{r.invoice_number}</TableCell><TableCell>{r.client_name}</TableCell><TableCell>{dateLabel(r.date)}</TableCell><TableCell className="text-right">{kes(r.amount)}</TableCell><TableCell className="text-right">{kes(paid)}</TableCell><TableCell className="text-right font-semibold">{kes(Math.max(0,money(r.amount)-paid))}</TableCell><TableCell><Badge variant={r.payment_status === 'paid' ? 'default' : 'secondary'}>{r.payment_status}</Badge></TableCell></TableRow>;
          })}
          {!(data.invoices || []).length && <TableRow><TableCell colSpan={7}><Empty>No invoices found.</Empty></TableCell></TableRow>}
        </TableBody></Table></div></CardContent></Card>
      )}

      {!loading && section === 'accounts-payable' && (
        <>
          <Card><CardHeader><CardTitle className="text-base">Approved expenses awaiting payment</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Supplier / Category</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Payment Status</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>
            {(data.expenses || []).filter((e: Row) => e.approval_status === 'approved').map((e: Row) => <TableRow key={e.id}><TableCell>{dateLabel(e.date)}</TableCell><TableCell>{e.supplier_name || e.category}</TableCell><TableCell>{e.description || '—'}</TableCell><TableCell className="text-right">{kes(e.amount)}</TableCell><TableCell><Badge variant={e.paid_at ? 'default' : 'secondary'}>{e.paid_at ? 'Paid' : 'Unpaid'}</Badge></TableCell><TableCell>{!e.paid_at && <Button size="sm" onClick={() => setPayExpense(e)}>Record payment</Button>}</TableCell></TableRow>)}
            {!(data.expenses || []).filter((e: Row) => e.approval_status === 'approved').length && <TableRow><TableCell colSpan={6}><Empty>No approved expenses awaiting payment.</Empty></TableCell></TableRow>}
          </TableBody></Table></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Payroll liabilities</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Payroll</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Net Pay</TableHead><TableHead>Status</TableHead><TableHead>Reference</TableHead></TableRow></TableHeader><TableBody>{(data.payroll || []).map((p: Row) => <TableRow key={p.id}><TableCell>{p.payroll_code}</TableCell><TableCell>{p.period_month}/{p.period_year}</TableCell><TableCell className="text-right">{kes(p.total_net)}</TableCell><TableCell><Badge variant="secondary">{p.status}</Badge></TableCell><TableCell>{p.payment_reference || '—'}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
        </>
      )}

      {!loading && section === 'assets-depreciation' && (
        <>
          <div className="flex justify-end"><Button onClick={() => setAssetOpen(true)}><Plus className="mr-2 h-4 w-4" />Register asset</Button></div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Asset Code</TableHead><TableHead>Asset</TableHead><TableHead>Purchase Date</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Accumulated Depreciation</TableHead><TableHead className="text-right">Net Book Value</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
            {(data.assets || []).map((a: Row) => <TableRow key={a.id}><TableCell className="font-mono">{a.asset_code}</TableCell><TableCell>{a.name}</TableCell><TableCell>{dateLabel(a.purchase_date)}</TableCell><TableCell className="text-right">{kes(a.purchase_cost)}</TableCell><TableCell className="text-right">{kes(a.accumulated_depreciation)}</TableCell><TableCell className="text-right font-semibold">{kes(money(a.purchase_cost)-money(a.accumulated_depreciation))}</TableCell><TableCell>{a.paid_at ? 'Paid' : 'Unpaid'}</TableCell><TableCell><Badge variant={a.status === 'approved' || a.status === 'active' ? 'default' : a.status === 'rejected' ? 'destructive' : 'secondary'}>{a.status}</Badge></TableCell></TableRow>)}
            {!(data.assets || []).length && <TableRow><TableCell colSpan={9}><Empty>No fixed assets registered.</Empty></TableCell></TableRow>}
          </TableBody></Table></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Depreciation schedule</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Asset ID</TableHead><TableHead>Date</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Depreciation</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{(data.schedules || []).map((s: Row) => <TableRow key={s.id}><TableCell className="font-mono">{s.asset_id.slice(0,8)}</TableCell><TableCell>{dateLabel(s.depreciation_date)}</TableCell><TableCell>{(data.periods || []).find((p: Row) => p.id === s.period_id)?.name || '—'}</TableCell><TableCell className="text-right">{kes(s.amount)}</TableCell><TableCell>{s.status}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
        </>
      )}

      {!loading && section === 'budgets-planning' && (
        <>
          <div className="flex justify-end"><Button onClick={() => setBudgetOpen(true)}><Plus className="mr-2 h-4 w-4" />New budget</Button></div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Budget</TableHead><TableHead>Financial Year</TableHead><TableHead className="text-right">Allocated</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {(data.budgets || []).map((b: Row) => <TableRow key={b.id}><TableCell className="font-medium">{b.name}</TableCell><TableCell>{(data.years || []).find((y: Row) => y.id === b.financial_year_id)?.name || '—'}</TableCell><TableCell className="text-right">{kes((data.lines || []).filter((l: Row) => l.budget_id === b.id).reduce((s: number,l: Row)=>s+money(l.amount),0))}</TableCell><TableCell><Badge variant={b.status === 'approved' ? 'default' : b.status === 'rejected' ? 'destructive' : 'secondary'}>{b.status}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setBudgetLineOpen(b); setBudgetLine({ account_id: '', period_id: '', amount: '0', notes: '' }); }}>Allocate</Button>{b.status === 'draft' && <Button size="sm" onClick={() => submitBudget(b)}>Submit</Button>}</div></TableCell></TableRow>)}
            {!(data.budgets || []).length && <TableRow><TableCell colSpan={5}><Empty>No budgets created.</Empty></TableCell></TableRow>}
          </TableBody></Table></div></CardContent></Card>
          {budgetLineOpen && <Card><CardHeader><CardTitle className="text-base">Allocations for {budgetLineOpen.name}</CardTitle></CardHeader><CardContent className="space-y-3">
            {(data.lines || []).filter((l: Row) => l.budget_id === budgetLineOpen.id).map((l: Row) => <div key={l.id} className="flex justify-between border-b pb-2 text-sm"><span>{(data.accounts || []).find((a: Row) => a.id === l.account_id)?.code} · {(data.accounts || []).find((a: Row) => a.id === l.account_id)?.name} — {(data.periods || []).find((p: Row) => p.id === l.period_id)?.name}</span><strong>{kes(l.amount)}</strong></div>)}
          </CardContent></Card>}
        </>
      )}

      {!loading && section === 'financial-reports' && (
        <>
          <div className="grid gap-3 sm:grid-cols-3"><Stat label="Total debits" value={kes(reportTotals.debit)} icon={TrendingDown} /><Stat label="Total credits" value={kes(reportTotals.credit)} icon={TrendingUp} /><Stat label="Difference" value={kes(reportTotals.debit-reportTotals.credit)} icon={ShieldCheck} /></div>
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Net Balance</TableHead></TableRow></TableHeader><TableBody>{reports.map((r: Row) => <TableRow key={r.account_id}><TableCell className="font-mono">{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell className="capitalize">{r.account_type}</TableCell><TableCell className="text-right">{kes(r.debit)}</TableCell><TableCell className="text-right">{kes(r.credit)}</TableCell><TableCell className="text-right font-semibold">{kes(r.balance)}</TableCell></TableRow>)}{!reports.length && <TableRow><TableCell colSpan={6}><Empty>No posted ledger activity in this date range.</Empty></TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
          <Alert><AlertDescription>Reports use posted journals only. Pending approvals, draft journals and unverified historical income/expenses are excluded to prevent double counting.</AlertDescription></Alert>
        </>
      )}

      {!loading && section === 'tax-compliance' && (
        <Card><CardHeader><CardTitle>Tax configuration</CardTitle></CardHeader><CardContent className="max-w-2xl space-y-4">
          <Alert><AlertDescription>VAT is disabled by default in this accounting configuration. Do not enable VAT or add VAT to invoices unless the business registration and applicable obligations have been confirmed.</AlertDescription></Alert>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">VAT registered</p><p className="text-xs text-muted-foreground">Only enable if registration is confirmed.</p></div><input type="checkbox" checked={settingsForm.vat_registered} onChange={(e) => setSettingsForm((f) => ({ ...f, vat_registered: e.target.checked }))} /></div>
          <div><Label>VAT rate (%)</Label><Input type="number" min="0" max="100" value={settingsForm.vat_rate} disabled={!settingsForm.vat_registered} onChange={(e) => setSettingsForm((f) => ({ ...f, vat_rate: e.target.value }))} /></div>
          <div><Label>Tax registration / compliance notes</Label><Textarea value={settingsForm.tax_registration_notes} onChange={(e) => setSettingsForm((f) => ({ ...f, tax_registration_notes: e.target.value }))} placeholder="Record confirmed tax registrations, filing notes and adviser guidance." /></div>
          <Button onClick={saveTaxSettings}>Save tax settings</Button>
        </CardContent></Card>
      )}

      {!loading && section === 'accounting-periods' && (
        <div className="space-y-4">
          {(data.years || []).map((year: Row) => {
            const periods = (data.periods || []).filter((p: Row) => p.financial_year_id === year.id);
            const allClosed = periods.length === 12 && periods.every((p: Row) => p.status === 'closed');
            return <Card key={year.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle>{year.name}</CardTitle><p className="text-xs text-muted-foreground">{dateLabel(year.starts_on)} – {dateLabel(year.ends_on)}</p></div><div className="flex items-center gap-2"><Badge variant={year.status === 'closed' ? 'default' : 'secondary'}>{year.status}</Badge>{year.status === 'open' && allClosed && <Button size="sm" onClick={() => closeYear(year)}>Close financial year</Button>}</div></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{periods.map((p: Row) => <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell>{dateLabel(p.starts_on)}</TableCell><TableCell>{dateLabel(p.ends_on)}</TableCell><TableCell><Badge variant={p.status === 'closed' ? 'default' : 'secondary'}>{p.status}</Badge></TableCell><TableCell className="text-right">{p.status === 'open' ? <Button size="sm" variant="outline" onClick={() => closePeriod(p)}>Close period</Button> : 'Locked'}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>;
          })}
        </div>
      )}

      {!loading && section === 'accounting-settings' && (
        <>
          <div className="flex justify-end"><Button onClick={() => setAccountOpen(true)}><Plus className="mr-2 h-4 w-4" />Add ledger account</Button></div>
          <Card><CardHeader><CardTitle>Chart of accounts</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Account Type</TableHead><TableHead>System Account</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{accounts.map((a: Row) => <TableRow key={a.id}><TableCell className="font-mono">{a.code}</TableCell><TableCell>{a.name}</TableCell><TableCell className="capitalize">{a.account_type}</TableCell><TableCell>{a.is_system_account ? 'Protected' : 'No'}</TableCell><TableCell>{a.is_active ? 'Active' : 'Inactive'}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Accounting controls</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Currency</span><strong>{settingsForm.currency_code}</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Financial year start</span><strong>January</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Independent approval required</span><Badge variant="default">Enabled</Badge></div><p className="pt-2 text-xs text-muted-foreground">System account codes and account classifications with posted activity are protected by database controls.</p></CardContent></Card>
        </>
      )}

      {!loading && section === 'approvals' && (
        <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Submission</TableHead><TableHead>Record</TableHead><TableHead>Submitted</TableHead><TableHead>Submitter</TableHead><TableHead>Summary</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
          {(data.approvals || []).map((a: Row) => {
            const d = a.detail || {};
            const summary = d.amount != null ? kes(d.amount) : d.total_net != null ? kes(d.total_net) : d.name || d.description || d.invoice_number || d.payroll_code || '—';
            const submittedByMe = a.submitted_by && a.submitted_by === user?.id;
            return <TableRow key={a.id}><TableCell><Badge variant="secondary" className="capitalize">{a.entity_type.replace(/_/g,' ')}</Badge></TableCell><TableCell className="font-mono text-xs">{a.entity_id.slice(0,8)}</TableCell><TableCell>{dateLabel(a.submitted_at)}</TableCell><TableCell className="font-mono text-xs">{a.submitted_by ? a.submitted_by.slice(0,8) : 'Legacy record'}</TableCell><TableCell>{summary}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={busy || submittedByMe} onClick={() => approve(a,'approved')}><CheckCircle2 className="mr-1 h-3 w-3" />Approve</Button><Button size="sm" variant="destructive" disabled={busy || submittedByMe} onClick={() => setApprovalTarget(a)}><XCircle className="mr-1 h-3 w-3" />Reject</Button></div>{submittedByMe && <p className="mt-1 text-[10px] text-muted-foreground">Another user must review</p>}</TableCell></TableRow>;
          })}
          {!(data.approvals || []).length && <TableRow><TableCell colSpan={6}><Empty>No pending accounting approvals.</Empty></TableCell></TableRow>}
        </TableBody></Table></div></CardContent></Card>
      )}

      {/* Manual journal composer */}
      <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Create journal entry</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Entry date</Label><Input type="date" value={journalForm.date} onChange={(e) => setJournalForm((f) => ({ ...f, date: e.target.value }))} /></div>
            <div><Label>Accounting period</Label><Select value={journalForm.period_id} onValueChange={(v) => setJournalForm((f) => ({ ...f, period_id: v }))}><SelectTrigger><SelectValue placeholder="Select open period" /></SelectTrigger><SelectContent>{(data.periods || []).filter((p: Row) => p.status === 'open').map((p: Row) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="sm:col-span-2"><Label>Description</Label><Input value={journalForm.description} onChange={(e) => setJournalForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="sm:col-span-2"><Label>Reference (optional)</Label><Input value={journalForm.reference} onChange={(e) => setJournalForm((f) => ({ ...f, reference: e.target.value }))} /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><h3 className="font-semibold">Journal lines</h3><Button size="sm" variant="outline" onClick={addLine}><Plus className="mr-1 h-3 w-3" />Add line</Button></div>
            {journalLines.map((line, index) => <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_minmax(0,1.5fr)]">
              <div><Label className="text-xs">Account</Label><Select value={line.account_id} onValueChange={(v) => setLine(index,'account_id',v)}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.filter((a: Row) => a.is_active).map((a: Row) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Debit</Label><Input type="number" min="0" value={line.debit} onChange={(e) => setLine(index,'debit',e.target.value)} /></div>
              <div><Label className="text-xs">Credit</Label><Input type="number" min="0" value={line.credit} onChange={(e) => setLine(index,'credit',e.target.value)} /></div>
              <div><Label className="text-xs">Line description</Label><Input value={line.description} onChange={(e) => setLine(index,'description',e.target.value)} /></div>
            </div>)}
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-sm"><span>Debits: <strong>{kes(journalLines.reduce((s,l)=>s+money(l.debit),0))}</strong></span><span>Credits: <strong>{kes(journalLines.reduce((s,l)=>s+money(l.credit),0))}</strong></span></div>
          <DialogFooter><Button variant="outline" onClick={() => setJournalOpen(false)}>Cancel</Button><Button onClick={saveJournal} disabled={busy}>Submit for approval</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank account */}
      <Dialog open={bankOpen} onOpenChange={setBankOpen}><DialogContent><DialogHeader><DialogTitle>Add bank account</DialogTitle></DialogHeader><div className="space-y-3">
        <div><Label>Ledger account</Label><Select value={bankForm.account_id} onValueChange={(v) => setBankForm((f) => ({ ...f, account_id: v }))}><SelectTrigger><SelectValue placeholder="Choose bank ledger account" /></SelectTrigger><SelectContent>{accounts.filter((a: Row) => a.account_type === 'asset' && a.code === '1020').map((a: Row) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Bank name</Label><Input value={bankForm.bank_name} onChange={(e) => setBankForm((f) => ({ ...f, bank_name: e.target.value }))} /></div>
        <div><Label>Account name</Label><Input value={bankForm.account_name} onChange={(e) => setBankForm((f) => ({ ...f, account_name: e.target.value }))} /></div>
        <div><Label>Masked account number</Label><Input value={bankForm.account_number_masked} onChange={(e) => setBankForm((f) => ({ ...f, account_number_masked: e.target.value }))} placeholder="****1234" /></div>
        <div><Label>Branch</Label><Input value={bankForm.branch_name} onChange={(e) => setBankForm((f) => ({ ...f, branch_name: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-2"><div><Label>Opening balance</Label><Input type="number" value={bankForm.opening_balance} onChange={(e) => setBankForm((f) => ({ ...f, opening_balance: e.target.value }))} /></div><div><Label>Balance date</Label><Input type="date" value={bankForm.opening_balance_date} onChange={(e) => setBankForm((f) => ({ ...f, opening_balance_date: e.target.value }))} /></div></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setBankOpen(false)}>Cancel</Button><Button onClick={saveBankAccount}>Save bank account</Button></DialogFooter></DialogContent></Dialog>

      {/* Petty cash movement */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}><DialogContent><DialogHeader><DialogTitle>Petty-cash movement</DialogTitle></DialogHeader><div className="space-y-3">
        <div><Label>Fund</Label><Select value={movementForm.fund_id} onValueChange={(v) => setMovementForm((f) => ({ ...f, fund_id: v }))}><SelectTrigger><SelectValue placeholder="Select fund" /></SelectTrigger><SelectContent>{(data.funds || []).map((f: Row) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Movement type</Label><Select value={movementForm.type} onValueChange={(v) => setMovementForm((f) => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="replenishment">Replenishment</SelectItem><SelectItem value="cash_return">Cash return</SelectItem><SelectItem value="adjustment_in">Adjustment in</SelectItem><SelectItem value="adjustment_out">Adjustment out</SelectItem></SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-2"><div><Label>Date</Label><Input type="date" value={movementForm.date} onChange={(e) => setMovementForm((f) => ({ ...f, date: e.target.value }))} /></div><div><Label>Amount</Label><Input type="number" value={movementForm.amount} onChange={(e) => setMovementForm((f) => ({ ...f, amount: e.target.value }))} /></div></div>
        <div><Label>Description</Label><Input value={movementForm.description} onChange={(e) => setMovementForm((f) => ({ ...f, description: e.target.value }))} /></div>
        <div><Label>Reference</Label><Input value={movementForm.reference} onChange={(e) => setMovementForm((f) => ({ ...f, reference: e.target.value }))} /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setMovementOpen(false)}>Cancel</Button><Button onClick={saveMovement}>Submit for approval</Button></DialogFooter></DialogContent></Dialog>

      {/* Expense payment */}
      <Dialog open={!!payExpense} onOpenChange={(open) => !open && setPayExpense(null)}><DialogContent><DialogHeader><DialogTitle>Record expense payment</DialogTitle></DialogHeader>{payExpense && <div className="space-y-3">
        <p className="text-sm">{payExpense.description || payExpense.category} · <strong>{kes(payExpense.amount)}</strong></p>
        <div><Label>Payment method</Label><Select value={payForm.method} onValueChange={(v) => setPayForm((f) => ({ ...f, method: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="mpesa">M-Pesa</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
        <div><Label>Payment reference {payForm.method === 'cash' ? '(optional)' : '*'}</Label><Input value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))} /></div>
        <div><Label>Payment date</Label><Input type="date" value={payForm.date} onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))} /></div>
      </div>}<DialogFooter><Button variant="outline" onClick={() => setPayExpense(null)}>Cancel</Button><Button onClick={payApprovedExpense}>Record payment</Button></DialogFooter></DialogContent></Dialog>

      {/* Fixed asset */}
      <Dialog open={assetOpen} onOpenChange={setAssetOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Register fixed asset</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Asset code</Label><Input value={assetForm.asset_code} onChange={(e) => setAssetForm((f) => ({ ...f, asset_code: e.target.value }))} /></div>
        <div><Label>Asset name</Label><Input value={assetForm.name} onChange={(e) => setAssetForm((f) => ({ ...f, name: e.target.value }))} /></div>
        <div><Label>Category</Label><Input value={assetForm.category} onChange={(e) => setAssetForm((f) => ({ ...f, category: e.target.value }))} /></div>
        <div><Label>Purchase date</Label><Input type="date" value={assetForm.purchase_date} onChange={(e) => setAssetForm((f) => ({ ...f, purchase_date: e.target.value }))} /></div>
        <div><Label>Purchase cost (KES)</Label><Input type="number" value={assetForm.purchase_cost} onChange={(e) => setAssetForm((f) => ({ ...f, purchase_cost: e.target.value }))} /></div>
        <div><Label>Residual value</Label><Input type="number" value={assetForm.residual_value} onChange={(e) => setAssetForm((f) => ({ ...f, residual_value: e.target.value }))} /></div>
        <div><Label>Useful life (months)</Label><Input type="number" value={assetForm.useful_life_months} onChange={(e) => setAssetForm((f) => ({ ...f, useful_life_months: e.target.value }))} /></div>
        <div><Label>Depreciation method</Label><Select value={assetForm.depreciation_method} onValueChange={(v) => setAssetForm((f) => ({ ...f, depreciation_method: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="straight_line">Straight line</SelectItem><SelectItem value="reducing_balance">Reducing balance</SelectItem><SelectItem value="none">No depreciation</SelectItem></SelectContent></Select></div>
        <div><Label>Asset account</Label><Select value={assetForm.asset_account_id} onValueChange={(v) => setAssetForm((f) => ({ ...f, asset_account_id: v }))}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.filter((a: Row) => a.account_type === 'asset').map((a: Row) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Depreciation expense account</Label><Select value={assetForm.depreciation_expense_account_id} onValueChange={(v) => setAssetForm((f) => ({ ...f, depreciation_expense_account_id: v }))}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.filter((a: Row) => a.account_type === 'expense').map((a: Row) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Accumulated depreciation account</Label><Select value={assetForm.accumulated_depreciation_account_id} onValueChange={(v) => setAssetForm((f) => ({ ...f, accumulated_depreciation_account_id: v }))}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.filter((a: Row) => a.account_type === 'asset').map((a: Row) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="sm:col-span-2"><Label>Source expense (if purchase was already recorded)</Label><Select value={assetForm.source_expense_id} onValueChange={(v) => setAssetForm((f) => ({ ...f, source_expense_id: v }))}><SelectTrigger><SelectValue placeholder="No linked expense — create acquisition journal" /></SelectTrigger><SelectContent>{(data.expenses || []).filter((e: Row) => e.category === 'equipment').map((e: Row) => <SelectItem key={e.id} value={e.id}>{dateLabel(e.date)} · {e.description || e.category} · {kes(e.amount)}</SelectItem>)}</SelectContent></Select></div>
        <div className="sm:col-span-2"><Label>Description</Label><Textarea value={assetForm.description} onChange={(e) => setAssetForm((f) => ({ ...f, description: e.target.value }))} /></div>
      </div><Alert><AlertDescription>Assets require independent approval. Depreciation will not be generated until the useful life and accounting treatment are confirmed.</AlertDescription></Alert><DialogFooter><Button variant="outline" onClick={() => setAssetOpen(false)}>Cancel</Button><Button onClick={saveAsset}>Submit asset for approval</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!depreciationAsset} onOpenChange={(open) => !open && setDepreciationAsset(null)}><DialogContent><DialogHeader><DialogTitle>Generate depreciation</DialogTitle></DialogHeader><div className="space-y-3">
        <p className="text-sm">{depreciationAsset?.asset_code} · {depreciationAsset?.name}</p>
        <div><Label>Accounting period</Label><Select value={depreciationPeriodId} onValueChange={setDepreciationPeriodId}><SelectTrigger><SelectValue placeholder="Select open month" /></SelectTrigger><SelectContent>{(data.periods || []).filter((p: Row) => p.status === 'open').map((p: Row) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        <p className="text-xs text-muted-foreground">The monthly charge will be submitted for independent approval before posting.</p>
      </div><DialogFooter><Button variant="outline" onClick={() => setDepreciationAsset(null)}>Cancel</Button><Button onClick={generateDepreciation}>Generate & submit</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!payAsset} onOpenChange={(open) => !open && setPayAsset(null)}><DialogContent><DialogHeader><DialogTitle>Pay fixed asset</DialogTitle></DialogHeader>{payAsset && <div className="space-y-3">
        <p className="text-sm">{payAsset.asset_code} · {payAsset.name} · <strong>{kes(payAsset.purchase_cost)}</strong></p>
        <div><Label>Payment method</Label><Select value={assetPayForm.method} onValueChange={(v) => setAssetPayForm((f) => ({ ...f, method: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="mpesa">M-Pesa</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
        <div><Label>Payment reference {assetPayForm.method === 'cash' ? '(optional)' : '*'}</Label><Input value={assetPayForm.reference} onChange={(e) => setAssetPayForm((f) => ({ ...f, reference: e.target.value }))} /></div>
        <div><Label>Payment date</Label><Input type="date" value={assetPayForm.date} onChange={(e) => setAssetPayForm((f) => ({ ...f, date: e.target.value }))} /></div>
      </div>}<DialogFooter><Button variant="outline" onClick={() => setPayAsset(null)}>Cancel</Button><Button onClick={payApprovedAsset}>Record payment</Button></DialogFooter></DialogContent></Dialog>

      {/* Budget */}
      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}><DialogContent><DialogHeader><DialogTitle>Create annual budget</DialogTitle></DialogHeader><div className="space-y-3">
        <div><Label>Budget name</Label><Input value={budgetForm.name} onChange={(e) => setBudgetForm((f) => ({ ...f, name: e.target.value }))} placeholder="Operating budget" /></div>
        <div><Label>Financial year</Label><Select value={budgetForm.financial_year_id} onValueChange={(v) => setBudgetForm((f) => ({ ...f, financial_year_id: v }))}><SelectTrigger><SelectValue placeholder="Select financial year" /></SelectTrigger><SelectContent>{(data.years || []).filter((y: Row) => y.status === 'open').map((y: Row) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Notes</Label><Textarea value={budgetForm.notes} onChange={(e) => setBudgetForm((f) => ({ ...f, notes: e.target.value }))} /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setBudgetOpen(false)}>Cancel</Button><Button onClick={saveBudget}>Create budget</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!budgetLineOpen} onOpenChange={(open) => !open && setBudgetLineOpen(null)}><DialogContent><DialogHeader><DialogTitle>Add budget allocation</DialogTitle></DialogHeader><div className="space-y-3">
        <div><Label>Account</Label><Select value={budgetLine.account_id} onValueChange={(v) => setBudgetLine((f) => ({ ...f, account_id: v }))}><SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.map((a: Row) => <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Month</Label><Select value={budgetLine.period_id} onValueChange={(v) => setBudgetLine((f) => ({ ...f, period_id: v }))}><SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger><SelectContent>{(data.periods || []).filter((p: Row) => p.status === 'open').map((p: Row) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Budget amount (KES)</Label><Input type="number" value={budgetLine.amount} onChange={(e) => setBudgetLine((f) => ({ ...f, amount: e.target.value }))} /></div>
        <div><Label>Notes</Label><Input value={budgetLine.notes} onChange={(e) => setBudgetLine((f) => ({ ...f, notes: e.target.value }))} /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setBudgetLineOpen(null)}>Cancel</Button><Button onClick={saveBudgetLine}>Save allocation</Button></DialogFooter></DialogContent></Dialog>

      {/* Accounting settings / account */}
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}><DialogContent><DialogHeader><DialogTitle>Add chart-of-accounts item</DialogTitle></DialogHeader><div className="space-y-3">
        <div><Label>Account code</Label><Input value={accountForm.code} onChange={(e) => setAccountForm((f) => ({ ...f, code: e.target.value }))} /></div>
        <div><Label>Account name</Label><Input value={accountForm.name} onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))} /></div>
        <div><Label>Account type</Label><Select value={accountForm.account_type} onValueChange={(v) => setAccountForm((f) => ({ ...f, account_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accountTypes.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Description</Label><Textarea value={accountForm.description} onChange={(e) => setAccountForm((f) => ({ ...f, description: e.target.value }))} /></div>
      </div><DialogFooter><Button variant="outline" onClick={() => setAccountOpen(false)}>Cancel</Button><Button onClick={addAccount}>Add account</Button></DialogFooter></DialogContent></Dialog>

      {/* Rejection reason */}
      <Dialog open={!!approvalTarget} onOpenChange={(open) => !open && setApprovalTarget(null)}><DialogContent><DialogHeader><DialogTitle>Reject accounting submission</DialogTitle></DialogHeader><div><Label>Reason for rejection *</Label><Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain what needs correction before resubmission." /></div><DialogFooter><Button variant="outline" onClick={() => setApprovalTarget(null)}>Cancel</Button><Button variant="destructive" disabled={!rejectReason.trim() || busy} onClick={() => approvalTarget && approve(approvalTarget,'rejected',rejectReason)}>Reject submission</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
