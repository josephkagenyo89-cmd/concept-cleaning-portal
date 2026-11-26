import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateLpoNumber } from "@/lib/numbering";

const AdminProcurement = () => {
  const [lpos, setLpos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLpoForm, setShowLpoForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [tab, setTab] = useState<"lpos" | "suppliers">("lpos");
  const [lpoForm, setLpoForm] = useState({ supplier_id: "", items: [{ description: "", qty: 1, unit_price: 0 }], notes: "" });
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "", address: "" });

  const load = async () => {
    const [l, s] = await Promise.all([
      supabase.from("lpos").select("*, suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("*").order("name"),
    ]);
    setLpos(l.data ?? []);
    setSuppliers(s.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addItem = () => setLpoForm({ ...lpoForm, items: [...lpoForm.items, { description: "", qty: 1, unit_price: 0 }] });
  const removeItem = (i: number) => setLpoForm({ ...lpoForm, items: lpoForm.items.filter((_, idx) => idx !== i) });
  const updateItem = (i: number, field: string, value: any) => {
    const items = [...lpoForm.items];
    (items[i] as any)[field] = value;
    setLpoForm({ ...lpoForm, items });
  };

  const totalAmount = lpoForm.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);

  const saveLpo = async () => {
    if (!lpoForm.supplier_id) { toast.error("Select a supplier"); return; }
    const lpoNum = await generateLpoNumber();
    const { error } = await supabase.from("lpos").insert({
      lpo_number: lpoNum,
      supplier_id: lpoForm.supplier_id,
      items: lpoForm.items,
      total_amount: totalAmount,
      notes: lpoForm.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`LPO ${lpoNum} created`);
    setShowLpoForm(false);
    setLpoForm({ supplier_id: "", items: [{ description: "", qty: 1, unit_price: 0 }], notes: "" });
    load();
  };

  const saveSupplier = async () => {
    if (!supplierForm.name) { toast.error("Name required"); return; }
    const { error } = await supabase.from("suppliers").insert(supplierForm);
    if (error) { toast.error(error.message); return; }
    toast.success("Supplier added");
    setShowSupplierForm(false);
    setSupplierForm({ name: "", phone: "", email: "", address: "" });
    load();
  };

  const updateApproval = async (id: string, status: string) => {
    const update: any = { approval_status: status };
    if (status === "Approved") {
      update.approved_by = "Admin";
      update.approved_at = new Date().toISOString();
    } else {
      update.approved_by = null;
      update.approved_at = null;
    }
    await supabase.from("lpos").update(update).eq("id", id);
    setLpos(lpos.map((l) => (l.id === id ? { ...l, ...update } : l)));
    toast.success(`LPO ${status}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Procurement</h2>
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "lpos" ? "default" : "outline"} onClick={() => setTab("lpos")}>LPOs</Button>
          <Button size="sm" variant={tab === "suppliers" ? "default" : "outline"} onClick={() => setTab("suppliers")}>
            <Building2 className="w-4 h-4 mr-1" /> Suppliers
          </Button>
        </div>
      </div>

      {tab === "suppliers" && (
        <div className="space-y-4">
          <Button size="sm" onClick={() => setShowSupplierForm(!showSupplierForm)}>
            <Plus className="w-4 h-4 mr-1" /> Add Supplier
          </Button>
          {showSupplierForm && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Name *" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
                <Input placeholder="Phone" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                <Input placeholder="Email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                <Input placeholder="Address" value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveSupplier}>Save</Button>
                <Button variant="outline" onClick={() => setShowSupplierForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {suppliers.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.phone} · {s.email}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                  await supabase.from("suppliers").delete().eq("id", s.id);
                  load();
                  toast.success("Deleted");
                }}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            {suppliers.length === 0 && <p className="p-4 text-sm text-muted-foreground">No suppliers yet.</p>}
          </div>
        </div>
      )}

      {tab === "lpos" && (
        <div className="space-y-4">
          <Button size="sm" onClick={() => setShowLpoForm(!showLpoForm)}>
            <Plus className="w-4 h-4 mr-1" /> New LPO
          </Button>
          {showLpoForm && (
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <Select value={lpoForm.supplier_id} onValueChange={(v) => setLpoForm({ ...lpoForm, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select Supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <p className="text-sm font-medium">Items</p>
                {lpoForm.items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input className="flex-1" placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                    <Input className="w-20" type="number" placeholder="Qty" value={item.qty} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} />
                    <Input className="w-28" type="number" placeholder="Price" value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", Number(e.target.value))} />
                    <Button variant="ghost" size="sm" onClick={() => removeItem(i)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
              </div>
              <p className="text-sm font-semibold">Total: KES {totalAmount.toLocaleString()}</p>
              <Textarea placeholder="Notes" value={lpoForm.notes} onChange={(e) => setLpoForm({ ...lpoForm, notes: e.target.value })} rows={2} />
              <div className="flex gap-2">
                <Button onClick={saveLpo}>Create LPO</Button>
                <Button variant="outline" onClick={() => setShowLpoForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">LPO #</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Supplier</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Approval</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Loading...</td></tr>}
                {!loading && lpos.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No LPOs yet.</td></tr>}
                {lpos.map((l) => (
                  <tr key={l.id}>
                    <td className="p-3 font-mono text-xs">{l.lpo_number}</td>
                    <td className="p-3">{(l.suppliers as any)?.name ?? "—"}</td>
                    <td className="p-3 font-semibold">KES {Number(l.total_amount).toLocaleString()}</td>
                    <td className="p-3">
                      <Select value={l.approval_status} onValueChange={(v) => updateApproval(l.id, v)}>
                        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Pending", "Approved", "Rejected"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                        await supabase.from("lpos").delete().eq("id", l.id);
                        load();
                      }}><Trash2 className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProcurement;
