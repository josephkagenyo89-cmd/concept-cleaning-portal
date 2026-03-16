import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DailyRevenue { date: string; total: number }
interface MonthlyRevenue { month: string; total: number }
interface AgentPerf { agent_id: string; full_name: string; bookings: number; revenue: number }
interface ExpenseByCategory { category: string; total: number }

export default function ErpReports() {
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [agentPerf, setAgentPerf] = useState<AgentPerf[]>([]);
  const [expenseReport, setExpenseReport] = useState<ExpenseByCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const [incomeRes, expenseRes, bookingsRes, profilesRes] = await Promise.all([
        supabase.from('income_records').select('date, amount'),
        supabase.from('expenses').select('category, amount'),
        supabase.from('bookings').select('agent_id, price, status'),
        supabase.from('profiles').select('user_id, full_name'),
      ]);

      const incomes = (incomeRes.data || []) as { date: string; amount: number }[];
      const expenses = (expenseRes.data || []) as { category: string; amount: number }[];
      const bookings = (bookingsRes.data || []) as { agent_id: string; price: number; status: string }[];
      const profiles = (profilesRes.data || []) as { user_id: string; full_name: string }[];

      // Daily revenue (last 30 days)
      const dailyMap = new Map<string, number>();
      incomes.forEach(i => dailyMap.set(i.date, (dailyMap.get(i.date) || 0) + Number(i.amount)));
      const daily = Array.from(dailyMap.entries()).map(([date, total]) => ({ date, total })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
      setDailyRevenue(daily);

      // Monthly revenue
      const monthMap = new Map<string, number>();
      incomes.forEach(i => { const m = i.date.substring(0, 7); monthMap.set(m, (monthMap.get(m) || 0) + Number(i.amount)); });
      const monthly = Array.from(monthMap.entries()).map(([month, total]) => ({ month, total })).sort((a, b) => b.month.localeCompare(a.month));
      setMonthlyRevenue(monthly);

      // Agent performance
      const agentMap = new Map<string, { bookings: number; revenue: number }>();
      bookings.filter(b => b.status !== 'cancelled').forEach(b => {
        const curr = agentMap.get(b.agent_id) || { bookings: 0, revenue: 0 };
        agentMap.set(b.agent_id, { bookings: curr.bookings + 1, revenue: curr.revenue + Number(b.price) });
      });
      const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
      const agents = Array.from(agentMap.entries()).map(([agent_id, data]) => ({
        agent_id, full_name: profileMap.get(agent_id) || 'Unknown', ...data,
      })).sort((a, b) => b.revenue - a.revenue);
      setAgentPerf(agents);

      // Expense by category
      const catMap = new Map<string, number>();
      expenses.forEach(e => catMap.set(e.category, (catMap.get(e.category) || 0) + Number(e.amount)));
      setExpenseReport(Array.from(catMap.entries()).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total));

      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) return <div className="flex justify-center p-8"><div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>
      <Tabs defaultValue="daily">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="daily">Daily Revenue</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Revenue</TabsTrigger>
          <TabsTrigger value="agents">Agent Sales</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="daily">
          <Card><CardHeader><CardTitle className="text-base">Daily Revenue (Last 30 days)</CardTitle></CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>{dailyRevenue.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow> :
                dailyRevenue.map(d => <TableRow key={d.date}><TableCell>{d.date}</TableCell><TableCell className="text-right font-medium text-green-600">KES {d.total.toLocaleString()}</TableCell></TableRow>)}
              </TableBody></Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="monthly">
          <Card><CardHeader><CardTitle className="text-base">Monthly Revenue</CardTitle></CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>{monthlyRevenue.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow> :
                monthlyRevenue.map(m => <TableRow key={m.month}><TableCell>{m.month}</TableCell><TableCell className="text-right font-medium text-green-600">KES {m.total.toLocaleString()}</TableCell></TableRow>)}
              </TableBody></Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="agents">
          <Card><CardHeader><CardTitle className="text-base">Agent Sales Performance</CardTitle></CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Agent</TableHead><TableHead className="text-right">Bookings</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>{agentPerf.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow> :
                agentPerf.map(a => <TableRow key={a.agent_id}><TableCell>{a.full_name}</TableCell><TableCell className="text-right">{a.bookings}</TableCell><TableCell className="text-right font-medium">KES {a.revenue.toLocaleString()}</TableCell></TableRow>)}
              </TableBody></Table>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="expenses">
          <Card><CardHeader><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader><CardContent className="p-0">
            <Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{expenseReport.length === 0 ? <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow> :
                expenseReport.map(e => <TableRow key={e.category}><TableCell className="capitalize">{e.category.replace(/_/g, ' ')}</TableCell><TableCell className="text-right font-medium text-red-500">KES {e.total.toLocaleString()}</TableCell></TableRow>)}
              </TableBody></Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
