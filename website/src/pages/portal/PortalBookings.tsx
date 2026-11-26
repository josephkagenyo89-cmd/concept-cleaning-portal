import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, RotateCw } from "lucide-react";

const statusStyle: Record<string, string> = {
  pending: "bg-gold/10 text-gold-foreground",
  approved: "bg-emerald/10 text-emerald",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
};

const PortalBookings = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: clients } = await supabase.from("clients").select("id").eq("user_id", user.id);
      const ids = (clients ?? []).map((c) => c.id);
      if (!ids.length) { setRows([]); setLoading(false); return; }
      const { data } = await supabase.from("bookings").select("*, services(name)").in("client_id", ids).order("service_date", { ascending: false });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-primary">My Bookings</h1>
        <Button asChild><Link to="/booking"><Calendar className="w-4 h-4 mr-2" />New Booking</Link></Button>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading && <p className="p-6 text-sm text-muted-foreground text-center">Loading…</p>}
        {!loading && rows.length === 0 && <p className="p-8 text-sm text-muted-foreground text-center">No bookings yet.</p>}
        <div className="divide-y divide-border">
          {rows.map((b) => (
            <div key={b.id} className="p-4 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{b.services?.name ?? "Cleaning service"}</p>
                <p className="text-xs text-muted-foreground">{b.booking_code ?? b.id.slice(0,8)} · {b.service_date}{b.service_time ? ` · ${b.service_time}` : ""}{b.location ? ` · ${b.location}` : ""}</p>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle[String(b.status).toLowerCase()] ?? "bg-muted"}`}>{b.status}</span>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/booking?service=${encodeURIComponent(b.services?.name ?? "")}`}><RotateCw className="w-3.5 h-3.5 mr-1.5" />Book Again</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortalBookings;
