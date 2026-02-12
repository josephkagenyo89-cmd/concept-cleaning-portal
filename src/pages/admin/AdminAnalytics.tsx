import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Loader2 } from 'lucide-react';

interface RevenuePoint { month: string; revenue: number }
interface ServiceBreakdown { name: string; count: number }
interface TopAgent { name: string; revenue: number }

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
];

export default function AdminAnalytics() {
  const [revenueData, setRevenueData] = useState<RevenuePoint[]>([]);
  const [serviceData, setServiceData] = useState<ServiceBreakdown[]>([]);
  const [topAgents, setTopAgents] = useState<TopAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);

      // Fetch completed bookings with service and agent info
      const { data: bookings } = await supabase
        .from('bookings')
        .select('price, service_date, service_id, agent_id, status')
        .eq('status', 'completed');

      const { data: services } = await supabase.from('services').select('id, name');
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');

      const serviceMap = new Map((services ?? []).map(s => [s.id, s.name]));
      const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p.full_name]));

      // 1. Revenue over time (last 6 months)
      const monthlyRevenue = new Map<string, number>();
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthlyRevenue.set(key, 0);
      }
      (bookings ?? []).forEach(b => {
        const d = new Date(b.service_date);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthlyRevenue.has(key)) {
          monthlyRevenue.set(key, (monthlyRevenue.get(key) ?? 0) + Number(b.price));
        }
      });
      setRevenueData(Array.from(monthlyRevenue, ([month, revenue]) => ({ month, revenue })));

      // 2. Bookings by service type
      const serviceCounts = new Map<string, number>();
      (bookings ?? []).forEach(b => {
        const name = serviceMap.get(b.service_id) ?? 'Unknown';
        serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
      });
      setServiceData(Array.from(serviceCounts, ([name, count]) => ({ name, count })));

      // 3. Top performing agents by revenue
      const agentRevenue = new Map<string, number>();
      (bookings ?? []).forEach(b => {
        const name = profileMap.get(b.agent_id) ?? 'Unknown';
        agentRevenue.set(name, (agentRevenue.get(name) ?? 0) + Number(b.price));
      });
      setTopAgents(
        Array.from(agentRevenue, ([name, revenue]) => ({ name, revenue }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5)
      );

      setLoading(false);
    }

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasData = revenueData.some(d => d.revenue > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics & Reports</h1>

      {!hasData && (
        <Card className="mb-6">
          <CardContent className="p-6 text-center text-muted-foreground">
            No completed bookings yet. Charts will populate once bookings are completed.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue Over Time (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                  <YAxis className="text-xs fill-muted-foreground" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`Ksh ${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bookings by Service */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bookings by Service Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={serviceData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {serviceData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Performing Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topAgents} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs fill-muted-foreground" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" className="text-xs fill-muted-foreground" width={100} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(value: number) => [`Ksh ${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
