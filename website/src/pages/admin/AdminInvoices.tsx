import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, MessageCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { whatsappLink, invoiceWhatsappMessage } from "@/lib/whatsapp";

const AdminInvoices = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*, clients(name, phone), bookings(booking_number, date)")
      .order("created_at", { ascending: false });
    setInvoices(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("invoices").update({ status }).eq("id", id);
    setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    toast.success(`Status updated to ${status}`);
  };

  const updateApproval = async (id: string, approval: string) => {
    const update: any = { approval_status: approval };
    if (approval === "Approved") {
      update.approved_by = "Admin";
      update.approved_at = new Date().toISOString();
    } else {
      update.approved_by = null;
      update.approved_at = null;
    }
    await supabase.from("invoices").update(update).eq("id", id);
    setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, ...update } : i)));
    toast.success(`Approval ${approval}`);
  };

  const handleExport = (inv: any) => {
    const clientName = (inv.clients as any)?.name ?? "Client";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Invoice ${inv.invoice_number}</title>
      <style>body{font-family:system-ui,sans-serif;padding:40px;max-width:600px;margin:auto}
      h1{color:#0f3a2e;margin-bottom:4px}h2{color:#10b981;font-size:14px;margin-top:0}
      table{width:100%;border-collapse:collapse;margin:20px 0}
      td,th{padding:10px;border-bottom:1px solid #eee;text-align:left}
      .total{font-size:18px;font-weight:bold;color:#0f3a2e}
      .footer{color:#999;font-size:12px;margin-top:40px}</style></head>
      <body>
        <h1>Concept Cleaning Services</h1>
        <h2>INVOICE</h2>
        <hr/>
        <p><strong>Invoice:</strong> ${inv.invoice_number}</p>
        <p><strong>Date:</strong> ${new Date(inv.created_at).toLocaleDateString()}</p>
        <p><strong>Client:</strong> ${clientName}</p>
        <p><strong>Phone:</strong> ${(inv.clients as any)?.phone ?? ""}</p>
        <table><tr><th>Service</th><th style="text-align:right">Amount (KES)</th></tr>
        <tr><td>${inv.service}</td><td style="text-align:right">${Number(inv.amount).toLocaleString()}</td></tr>
        <tr><td class="total">Total</td><td style="text-align:right" class="total">KES ${Number(inv.amount).toLocaleString()}</td></tr></table>
        <p class="footer">Thank you for choosing Concept Cleaning Services.<br/>Phone: +254 796 563 741</p>
      </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Invoices</h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Service</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Approval</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Loading...</td></tr>}
              {!loading && invoices.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No invoices yet.</td></tr>}
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="p-3 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="p-3 font-medium">{(inv.clients as any)?.name ?? "—"}</td>
                  <td className="p-3 hidden sm:table-cell text-muted-foreground">{inv.service}</td>
                  <td className="p-3 font-semibold">KES {Number(inv.amount).toLocaleString()}</td>
                  <td className="p-3">
                    <Select value={inv.approval_status} onValueChange={(v) => updateApproval(inv.id, v)}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Pending", "Approved", "Rejected"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <Select value={inv.status} onValueChange={(v) => updateStatus(inv.id, v)}>
                      <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Pending", "Paid", "Overdue"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleExport(inv)}>
                        <Download className="w-3.5 h-3.5 mr-1" /> PDF
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs" asChild>
                        <a href={whatsappLink(invoiceWhatsappMessage({ clientName: (inv.clients as any)?.name ?? "Client", amount: Number(inv.amount), invoiceNumber: inv.invoice_number }))} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="w-3.5 h-3.5 mr-1" /> Send
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

export default AdminInvoices;
