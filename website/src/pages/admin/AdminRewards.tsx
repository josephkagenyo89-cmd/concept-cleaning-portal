import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MessageCircle, Gift } from "lucide-react";
import { toast } from "sonner";
import { whatsappLink } from "@/lib/whatsapp";
import { rewardWhatsappMessage } from "@/lib/rewards";

const AdminRewards = () => {
  const [rewards, setRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("rewards")
        .select("*, clients(name, phone), bookings(booking_number, service)")
        .order("created_at", { ascending: false });
      setRewards(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("rewards").update({ status }).eq("id", id);
    setRewards((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.success(`Reward marked as ${status}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Rewards</h2>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Booking</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Tier</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Items</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Loading...</td></tr>}
              {!loading && rewards.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No rewards yet.</td></tr>}
              {rewards.map((r) => {
                const items = (r.items as string[]) ?? [];
                return (
                  <tr key={r.id}>
                    <td className="p-3 font-mono text-xs">{(r.bookings as any)?.booking_number ?? "—"}</td>
                    <td className="p-3 font-medium">{(r.clients as any)?.name ?? "—"}</td>
                    <td className="p-3">KES {Number(r.amount).toLocaleString()}</td>
                    <td className="p-3 hidden sm:table-cell">
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">{r.tier}</span>
                    </td>
                    <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{items.join(", ")}</td>
                    <td className="p-3">
                      <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                        <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Pending", "Issued"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm" className="text-xs" asChild>
                        <a
                          href={whatsappLink(rewardWhatsappMessage((r.clients as any)?.name ?? "", items))}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="w-3.5 h-3.5 mr-1" /> WA
                        </a>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRewards;
