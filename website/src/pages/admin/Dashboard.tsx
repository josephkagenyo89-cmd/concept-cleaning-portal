import { useEffect, useState } from "react";
import { CalendarDays, Users, Clock, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalClients, setTotalClients] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [bk, cl, pend, recent, invPaid, pendAppr] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "Pending"),
        supabase.from("bookings").select("*, clients(name)").order("created_at", { ascending: false }).limit(5),
        supabase.from("invoices").select("amount").eq("status", "Paid"),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("approval_status", "Pending"),
      ]);
      setTotalBookings(bk.count ?? 0);
      setTotalClients(cl.count ?? 0);
      setPendingCount(pend.count ?? 0);
      setRecentBookings(recent.data ?? []);
      setRevenue((invPaid.data ?? []).reduce((sum, i) => sum + Number(i.amount), 0));
      setPendingApprovals(pendAppr.count ?? 0);
    };
    load();
  }, []);

  const stats = [
    { label: "Total Bookings", value: totalBookings, icon: CalendarDays },
    { label: "Total Clients", value: totalClients, icon: Users },
    { label: "Pending", value: pendingCount, icon: Clock },
    { label: "Revenue (Paid)", value: `KES ${revenue.toLocaleString()}`, icon: DollarSign },
  ];

  const statusColor: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-700",
    Approved: "bg-blue-100 text-blue-700",
    Completed: "bg-emerald-100 text-emerald-700",
    Cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-accent flex items-center justify-center">
              <s.icon className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {pendingApprovals > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠️ {pendingApprovals} invoice(s) pending approval
        </div>
      )}

      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Recent Bookings</h2>
        </div>
        <div className="divide-y divide-border">
          {recentBookings.length === 0 && <p className="p-4 text-sm text-muted-foreground">No bookings yet.</p>}
          {recentBookings.map((b: any) => (
            <div key={b.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{(b.clients as any)?.name ?? "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{b.service} · {b.date}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[b.status] ?? ""}`}>
                  {b.status}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{b.booking_number}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
