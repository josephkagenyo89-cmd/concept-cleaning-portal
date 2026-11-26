import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download } from "lucide-react";

const PortalDocuments = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: clients } = await supabase.from("clients").select("id").eq("user_id", user.id);
      const ids = (clients ?? []).map((c) => c.id);
      if (!ids.length) { setLoading(false); return; }
      const [i, q] = await Promise.all([
        supabase.from("invoices").select("*").in("client_id", ids).order("created_at", { ascending: false }),
        supabase.from("quotations").select("*").in("client_id", ids).order("created_at", { ascending: false }),
      ]);
      setInvoices(i.data ?? []);
      setQuotes(q.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-primary">My Documents</h1>

      <Section title="Invoices" items={invoices} numField="invoice_number" empty="No invoices yet." />
      <Section title="Quotations" items={quotes} numField="quotation_number" empty="No quotations yet." />

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
};

const Section = ({ title, items, numField, empty }: any) => (
  <section>
    <h2 className="text-sm uppercase tracking-widest text-muted-foreground mb-2">{title}</h2>
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {items.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground text-center">{empty}</p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((d: any) => (
            <div key={d.id} className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{d[numField]}</p>
                <p className="text-xs text-muted-foreground truncate">{d.service ?? d.service_name ?? "Service"} · KES {Number(d.amount ?? d.price ?? 0).toLocaleString()}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => window.print()}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  </section>
);

export default PortalDocuments;
