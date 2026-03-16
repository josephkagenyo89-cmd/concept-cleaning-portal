import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, TrendingDown, CalendarDays, Calendar } from 'lucide-react';

interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  revenueToday: number;
  revenueThisMonth: number;
}

export default function ErpDashboard() {
  const [summary, setSummary] = useState<FinanceSummary>({
    totalRevenue: 0, totalExpenses: 0, revenueToday: 0, revenueThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      const [incomeRes, expenseRes] = await Promise.all([
        supabase.from('income_records').select('amount, date'),
        supabase.from('expenses').select('amount'),
      ]);

      const incomes = (incomeRes.data || []) as { amount: number; date: string }[];
      const expenses = (expenseRes.data || []) as { amount: number }[];

      const totalRevenue = incomes.reduce((s, i) => s + Number(i.amount), 0);
      const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
      const revenueToday = incomes.filter(i => i.date === today).reduce((s, i) => s + Number(i.amount), 0);
      const revenueThisMonth = incomes.filter(i => i.date >= monthStart).reduce((s, i) => s + Number(i.amount), 0);

      setSummary({ totalRevenue, totalExpenses, revenueToday, revenueThisMonth });
      setLoading(false);
    };
    fetchSummary();
  }, []);

  const profit = summary.totalRevenue - summary.totalExpenses;

  const cards = [
    { title: 'Total Revenue', value: summary.totalRevenue, icon: DollarSign, color: 'text-green-600' },
    { title: 'Total Expenses', value: summary.totalExpenses, icon: TrendingDown, color: 'text-red-500' },
    { title: 'Profit', value: profit, icon: TrendingUp, color: profit >= 0 ? 'text-green-600' : 'text-red-500' },
    { title: 'Revenue Today', value: summary.revenueToday, icon: CalendarDays, color: 'text-primary' },
    { title: 'Revenue This Month', value: summary.revenueThisMonth, icon: Calendar, color: 'text-primary' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center p-8"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ERP & Accounting</h1>
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
    </div>
  );
}
