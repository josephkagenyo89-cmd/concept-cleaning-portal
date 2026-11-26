import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Images, MessageCircle, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { whatsappLink, adminBookingAlert } from "@/lib/whatsapp";
import { generateInvoiceNumber } from "@/lib/numbering";
import { getRewardTier } from "@/lib/rewards";
import RewardBadge from "@/components/RewardBadge";

const statusColor: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-blue-100 text-blue-700",
  Completed: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-red-100 text-red-700",
};

const AdminBookings = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [bk, st] = await Promise.all([
      supabase.from("bookings").select("*, clients(name, phone, location)").order("created_at", { ascending: false }),
      supabase.from("staff").select("id, name").eq("status", "Active"),
    ]);
    setBookings(bk.data ?? []);
    setStaffList(st.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    const booking = bookings.find((b) => b.id === id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    toast.success(`Status updated to ${status}`);

    // Auto-assign reward on completion
    if (status === "Completed" && booking) {
      const { data: svc } = await supabase.from("services").select("price_value").eq("name", booking.service).single();
      const amount = svc?.price_value ?? 0;
      const tier = getRewardTier(amount);
      if (tier) {
        const { data: existing } = await supabase.from("rewards").select("id").eq("booking_id", id).limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("rewards").insert({
            booking_id: id,
            client_id: booking.client_id,
            amount,
            tier: tier.label,
            items: tier.items,
            status: "Pending",
          });
          toast.success(`🎁 ${tier.label} reward assigned!`);
        }
      }
    }
  };

  const assignStaff = async (bookingId: string, staffId: string) => {
    await supabase.from("bookings").update({ assigned_staff_id: staffId }).eq("id", bookingId);
    await supabase.from("job_assignments").insert({ booking_id: bookingId, staff_id: staffId });
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, assigned_staff_id: staffId } : b)));
    toast.success("Staff assigned");
  };

  const generateInvoice = async (b: any) => {
    if (b.status !== "Completed") {
      toast.error("Only completed bookings can generate invoices");
      return;
    }
    const { data: svc } = await supabase.from("services").select("price_value").eq("name", b.service).single();
    const amount = svc?.price_value ?? 0;
    const invNum = await generateInvoiceNumber();

    const { error } = await supabase.from("invoices").insert({
      invoice_number: invNum,
      booking_id: b.id,
      client_id: b.client_id,
      service: b.service,
      amount,
      status: "Pending",
      approval_status: "Pending",
    });
    if (error) {
      if (error.code === "23505") toast.error("Invoice already exists");
      else toast.error("Failed to generate invoice");
      return;
    }
    toast.success(`Invoice ${invNum} generated`);
  };

  const postToPortfolio = (b: any) => {
    if (b.status !== "Completed") {
      toast.error("Only completed bookings can be posted");
      return;
    }
    const params = new URLSearchParams({
      booking_id: b.id, client_id: b.client_id ?? "", service: b.service,
      client_name: (b.clients as any)?.name ?? "", date: b.date,
    });
    window.location.href = `/admin/portfolio?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">All Bookings</h2>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Booking #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Service</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Staff</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Loading...</td></tr>}
              {!loading && bookings.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No bookings yet.</td></tr>}
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="p-3 font-mono text-xs">{b.booking_number}</td>
                  <td className="p-3">
                    <p className="font-medium">{(b.clients as any)?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{(b.clients as any)?.phone ?? ""}</p>
                  </td>
                  <td className="p-3 hidden sm:table-cell">{b.service}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{b.date}{b.time ? ` · ${b.time}` : ""}</td>
                  <td className="p-3">
                    <Select value={b.status} onValueChange={(v) => updateStatus(b.id, v)}>
                      <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Pending", "Approved", "Completed", "Cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <Select value={b.assigned_staff_id ?? ""} onValueChange={(v) => assignStaff(b.id, v)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Assign" /></SelectTrigger>
                      <SelectContent>
                        {staffList.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1 flex-wrap">
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => generateInvoice(b)} disabled={b.status !== "Completed"}>
                        <FileText className="w-3.5 h-3.5 mr-1" /> Invoice
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => postToPortfolio(b)} disabled={b.status !== "Completed"}>
                        <Images className="w-3.5 h-3.5 mr-1" /> Post
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs" asChild>
                        <a href={whatsappLink(adminBookingAlert({ name: (b.clients as any)?.name ?? "", phone: (b.clients as any)?.phone ?? "", service: b.service, location: b.location ?? "", date: b.date }))} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="w-3.5 h-3.5 mr-1" /> WA
                        </a>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBookings;
