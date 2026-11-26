import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Sofa, Package } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";

const ROOMS = ["Living Room", "Bedroom", "Kitchen", "Dining", "Bathroom", "Office", "Vehicle", "Outdoor", "Other"];
const CATEGORIES = ["Sofa", "Mattress", "Carpet", "Curtains", "Chairs", "Vehicle", "Appliance", "Other"];

const emptyForm = {
  property_id: "", room: "Living Room", category: "Sofa", name: "",
  size: "", material: "", last_cleaned_at: "", notes: "",
};

const PortalAssets = () => {
  const { user, profile } = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [a, p] = await Promise.all([
      supabase.from("customer_property_assets").select("*, customer_properties(name)").order("created_at", { ascending: false }),
      supabase.from("customer_properties").select("id, name").order("name"),
    ]);
    setAssets(a.data ?? []);
    setProperties(p.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const startAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, property_id: properties[0]?.id ?? "" });
    setOpen(true);
  };
  const startEdit = (a: any) => {
    setEditing(a);
    setForm({ ...emptyForm, ...a, last_cleaned_at: a.last_cleaned_at ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!user || !form.name || !form.property_id) { toast.error("Property and name are required"); return; }
    const payload = {
      user_id: user.id,
      client_id: profile?.id,
      property_id: form.property_id,
      room: form.room, category: form.category, name: form.name,
      size: form.size || null, material: form.material || null,
      last_cleaned_at: form.last_cleaned_at || null, notes: form.notes || null,
    };
    const q = editing
      ? supabase.from("customer_property_assets").update(payload).eq("id", editing.id)
      : supabase.from("customer_property_assets").insert(payload);
    const { error } = await q;
    if (error) { toast.error("Failed to save"); return; }
    toast.success(editing ? "Asset updated" : "Asset added");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this asset?")) return;
    await supabase.from("customer_property_assets").delete().eq("id", id);
    toast.success("Deleted");
    load();
  };

  const daysSince = (d?: string | null) => d ? differenceInDays(new Date(), parseISO(d)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary">My Assets</h1>
          <p className="text-sm text-muted-foreground">Sofas, mattresses, carpets and more — tick them at checkout.</p>
        </div>
        <Button onClick={startAdd} disabled={properties.length === 0} className="gap-2"><Plus className="w-4 h-4" /> Add Asset</Button>
      </div>

      {properties.length === 0 && !loading && (
        <div className="text-center py-8 rounded-2xl bg-muted/50 text-sm text-muted-foreground">
          Add a property first, then add assets to it.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : assets.length === 0 && properties.length > 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Package className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
          <p className="text-muted-foreground mb-4">No assets yet.</p>
          <Button onClick={startAdd}>Add Asset</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((a, i) => {
            const days = daysSince(a.last_cleaned_at);
            const stale = days !== null && days > 180;
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="group rounded-2xl border border-border bg-card p-4 hover:shadow-lg transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Sofa className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{a.name}</h3>
                      <p className="text-[11px] text-muted-foreground">{a.customer_properties?.name} · {a.room}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(a)}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(a.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.size && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{a.size}</span>}
                  {a.material && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted">{a.material}</span>}
                  {a.last_cleaned_at ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${stale ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      Cleaned {format(parseISO(a.last_cleaned_at), "MMM d")}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Never cleaned</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Asset" : "Add Asset"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Property *</label>
              <Select value={form.property_id} onValueChange={v => setForm({ ...form, property_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choose property" /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Room</label>
                <Select value={form.room} onValueChange={v => setForm({ ...form, room: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROOMS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Category</label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Input placeholder="Name (e.g. 7 Seater Sofa)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Size (e.g. King)" value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} />
              <Input placeholder="Material (e.g. Leather)" value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Last cleaned</label>
              <Input type="date" value={form.last_cleaned_at} onChange={e => setForm({ ...form, last_cleaned_at: e.target.value })} />
            </div>
            <Button className="w-full" onClick={save}>{editing ? "Save Changes" : "Add Asset"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalAssets;
