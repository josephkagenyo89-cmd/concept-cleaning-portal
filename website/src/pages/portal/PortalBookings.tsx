import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, RotateCw, ClipboardList } from "lucide-react";

const statusStyle: Record<string, string> = {
  pending: "bg-gold/10 text-gold-foreground",
  received: "bg-blue-50 text-blue-700",
  new: "bg-blue-50 text-blue-700",
  contacted: "bg-sky-50 text-sky-700",
  qualified: "bg-emerald/10 text-emerald",
  proposal: "bg-gold/10 text-gold-foreground",
  negotiation: "bg-orange-50 text-orange-700",
  won: "bg-emerald/10 text-emerald",
  converted: "bg-emerald/10 text-emerald",
  approved: "bg-emerald/10 text-emerald",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
  lost: "bg-destructive/10 text-destructive",
};

const statusLabel = (status: string) =>
  String(status || "received").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const PortalBookings = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [requestItems, setRequestItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: clientRows }, { data: requestRows }] = await Promise.all([
        supabase.from("clients").select("id").eq("user_id", user.id),
        supabase.from("website_service_requests")
          .select("id,request_reference,status,created_at,preferred_date,preferred_time,service_location")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      const clientIds = (clientRows ?? []).map((client) => client.id);
      const [{ data: bookings }, { data: items }] = await Promise.all([
        clientIds.length
          ? supabase.from("bookings").select("*, services(name)").in("client_id", clientIds).order("service_date", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        requestRows?.length
          ? supabase.from("website_service_request_items").select("request_id,service_name,quantity").in("request_id", requestRows.map((request) => request.id)).order("created_at", { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (!active) return;
      setRows(bookings ?? []);
      setRequests(requestRows ?? []);
      const grouped: Record<string, any[]> = {};
      (items ?? []).forEach((item: any) => {
        grouped[item.request_id] = grouped[item.request_id] ?? [];
        grouped[item.request_id].push(item);
      });
      setRequestItems(grouped);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h2 className="font-display text-xl font-bold text-primary">My Service Requests</h2>
        </div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {loading && <p className="p-6 text-sm text-muted-foreground text-center">Loading…</p>}
          {!loading && requests.length === 0 && <p className="p-6 text-sm text-muted-foreground text-center">No service requests yet. Submit a request and track its progress here.</p>}
          <div className="divide-y divide-border">
            {requests.map((request) => (
              <div key={request.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold">{request.request_reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString()} · {request.service_location}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle[String(request.status).toLowerCase()] ?? "bg-muted"}`}>
                    {statusLabel(request.status)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {(requestItems[request.id] ?? []).map((item) => `${item.service_name} × ${item.quantity}`).join(" · ") || "Service details"}
                </div>
                {(request.preferred_date || request.preferred_time) && (
                  <p className="text-xs text-muted-foreground">
                    Preferred: {request.preferred_date ?? "Date to be confirmed"}{request.preferred_time ? ` · ${request.preferred_time}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
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
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle[String(b.status).toLowerCase()] ?? "bg-muted"}`}>{statusLabel(b.status)}</span>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/booking?service=${encodeURIComponent(b.services?.name ?? "")}`}><RotateCw className="w-3.5 h-3.5 mr-1.5" />Book Again</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default PortalBookings;
