import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, Gift } from "lucide-react";

const AdminClients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [clientDetails, setClientDetails] = useState<Record<string, any>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("clients")
        .select("*, bookings(id)")
        .order("created_at", { ascending: false });
      setClients(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!clientDetails[id]) {
      const [bookings, invoices, rewards] = await Promise.all([
        supabase.from("bookings").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("client_id", id).order("created_at", { ascending: false }),
        supabase.from("rewards").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      ]);
      setClientDetails((prev) => ({
        ...prev,
        [id]: { bookings: bookings.data ?? [], invoices: invoices.data ?? [], rewards: rewards.data ?? [] },
      }));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Clients</h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
        {!loading && clients.length === 0 && <p className="p-4 text-sm text-muted-foreground">No clients yet.</p>}
        <div className="divide-y divide-border">
          {clients.map((c) => {
            const bookingCount = (c.bookings as any[])?.length ?? 0;
            const details = clientDetails[c.id];
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id}>
                <button
                  onClick={() => toggleExpand(c.id)}
                  className="w-full p-4 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone} · {c.location ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="bg-accent text-accent-foreground text-xs font-medium px-2.5 py-1 rounded-full">
                      {bookingCount} bookings
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {isExpanded && details && (
                  <div className="px-4 pb-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Bookings</p>
                      {details.bookings.length === 0 ? (
                        <p className="text-xs text-muted-foreground">None</p>
                      ) : (
                        <div className="space-y-1">
                          {details.bookings.map((b: any) => (
                            <div key={b.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-xs">
                              <span>{b.booking_number} · {b.service}</span>
                              <span className="text-muted-foreground">{b.status} · {b.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Invoices</p>
                      {details.invoices.length === 0 ? (
                        <p className="text-xs text-muted-foreground">None</p>
                      ) : (
                        <div className="space-y-1">
                          {details.invoices.map((i: any) => (
                            <div key={i.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-xs">
                              <span>{i.invoice_number} · {i.service}</span>
                              <span className="text-muted-foreground">KES {Number(i.amount).toLocaleString()} · {i.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Gift className="w-3 h-3" /> Rewards</p>
                      {details.rewards.length === 0 ? (
                        <p className="text-xs text-muted-foreground">None</p>
                      ) : (
                        <div className="space-y-1">
                          {details.rewards.map((r: any) => (
                            <div key={r.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-xs">
                              <span>{r.tier} · {((r.items as string[]) ?? []).join(", ")}</span>
                              <span className="text-muted-foreground">{r.status} · KES {Number(r.amount).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminClients;
