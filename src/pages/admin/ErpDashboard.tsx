import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, TrendingDown, CalendarDays, Calendar, FileText, Receipt, PieChart, Clock3, AlertTriangle, CircleDollarSign, ArrowRight } from 'lucide-react';

interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  revenueToday: number;
  revenueThisMonth: number;
  paidInvoices: number;
  unpaidInvoices: number;
  overdueInvoices: number;
}

export default function ErpDashboard() {
  const [summary, setSummary] = useState<FinanceSummary>({
    totalRevenue: 0, totalExpenses: 0, revenueToday: 0, revenueThisMonth: 0,
    paidInvoices: 0, unpaidInvoices: 0, overdueInvoices: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      const [incomeRes, expenseRes, invoiceRes] = await Promise.all([
        supabase.from('income_records').select('amount, date').eq('status', 'approved'),
        supabase.from('expenses').select('amount'),
        supabase.from('invoices').select('amount, due_date, payment_status'),
      ]);

      const incomes = (incomeRes.data || []) as { amount: number; date: string }[];
      const expenses = (expenseRes.data || []) as { amount: number }[];
      const invoices = (invoiceRes.data || []) as { amount: number; due_date: string | null; payment_status: string }[];
      const totalRevenue = incomes.reduce((s, i) => s + Number(i.amount), 0);
      const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
      const revenueToday = incomes.filter(i => i.date === today).reduce((s, i) => s + Number(i.amount), 0);
      const revenueThisMonth = incomes.filter(i => i.date >= monthStart).reduce((s, i) => s + Number(i.amount), 0);
      const paidInvoices = invoices.filter(i => i.payment_status === 'paid').length;
      const unpaidInvoices = invoices.filter(i => !['paid', 'cancelled'].includes(i.payment_status)).length;
      const overdueInvoices = invoices.filter(i => !['paid', 'cancelled'].includes(i.payment_status) && !!i.due_date && i.due_date < today).length;

      setSummary({ totalRevenue, totalExpenses, revenueToday, revenueThisMonth, paidInvoices, unpaidInvoices, overdueInvoices });
      setLoading(false);
    };
    fetchSummary();
  }, []);

  const profit = summary.totalRevenue - summary.totalExpenses;

  const cards = [
    { title: 'Approved receipts (operational)', value: summary.totalRevenue, icon: DollarSign, color: 'text-green-600' },
    { title: 'Recorded expenses', value: summary.totalExpenses, icon: TrendingDown, color: 'text-red-500' },
    { title: 'Net cash movement*', value: profit, icon: TrendingUp, color: profit >= 0 ? 'text-green-600' : 'text-red-500' },
    { title: 'Approved receipts today', value: summary.revenueToday, icon: CalendarDays, color: 'text-primary' },
    { title: 'Approved receipts this month', value: summary.revenueThisMonth, icon: Calendar, color: 'text-primary' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center p-8"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ERP & Accounting</h1>
      <p className="text-sm text-muted-foreground">Operational summaries from approved income records and recorded expenses. These are not yet formal ledger-based financial statements; those will be introduced after ledger posting and historical reconciliation are verified.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map(c => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${c.color}`}>KES {c.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/admin/erp/invoices"><Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30"><CardContent className="flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><div className="rounded-full bg-muted p-2"><CircleDollarSign className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Paid invoices</p><p className="text-2xl font-semibold">{summary.paidInvoices}</p></div></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></CardContent></Card></Link>
        <Link to="/admin/erp/invoices"><Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30"><CardContent className="flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><div className="rounded-full bg-muted p-2"><Clock3 className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Unpaid / awaiting payment</p><p className="text-2xl font-semibold">{summary.unpaidInvoices}</p></div></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></CardContent></Card></Link>
        <Link to="/admin/erp/invoices"><Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30"><CardContent className="flex items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><div className="rounded-full bg-muted p-2"><AlertTriangle className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">Overdue invoices</p><p className="text-2xl font-semibold">{summary.overdueInvoices}</p></div></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></CardContent></Card></Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild><Link to="/admin/erp/invoices"><FileText className="mr-2 h-4 w-4" />Manage invoices</Link></Button>
        <Button variant="outline" asChild><Link to="/admin/erp/income"><DollarSign className="mr-2 h-4 w-4" />Income records</Link></Button>
        <Button variant="outline" asChild><Link to="/admin/erp/expenses"><Receipt className="mr-2 h-4 w-4" />Record expenses</Link></Button>
        <Button variant="outline" asChild><Link to="/admin/erp/reports"><PieChart className="mr-2 h-4 w-4" />View reports</Link></Button>
      </div>
    </div>
  );
}
