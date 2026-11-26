import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Home, Plus, MapPin, Pencil, Trash2, Building2, Car, Store } from "lucide-react";
import { toast } from "sonner";

const PROPERTY_TYPES = ["Home", "Office", "Airbnb", "Commercial", "Vehicle"];

const iconFor = (type: string) => {
  switch (type) {
    case "Office": return Building2;
    case "Vehicle": return Car;
    case "Commercial": return Store;
    default: return Home;
  }
};

const emptyForm = {
  name: "", type: "Home", county: "", estate: "", address: "",
  maps_url: "", bedrooms: "", floors: "", parking_notes: "", gate_notes: "", notes: "",
};

const PortalProperties = () => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("customer_properties").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const startAdd = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (p: any) => {
    setEditing(p);
    setForm({ ...emptyForm, ...p, bedrooms: p.bedrooms ?? "", floors: p.floors ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!user || !form.name) { toast.error("Property name is required"); return; }
    const payload = {
      user_id: user.id,
      client_id: profile?.id,
      name: form.name, type: form.type, county: form.county || null, estate: form.estate || null,
      address: form.address || null, maps_url: form.maps_url || null,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      floors: form.floors ? Number(form.floors) : null,
      parking_notes: form.parking_notes || null, gate_notes: form.gate_notes || null, notes: form.notes || null,
    };
    const q = editing
      ? supabase.from("customer_properties").update(payload).eq("id", editing.id)
      : supabase.from("customer_properties").insert(payload);
    const { error } = await q;
    if (error) { toast.error("Failed to save"); return; }
    toast.success(editing ? "Property updated" : "Property added");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this property?")) return;
    await supabase.from("customer_properties").delete().eq("id", id);
    toast.success("Deleted");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary">My Properties</h1>
          <p className="text-sm text-muted-foreground">Save homes, offices and vehicles for one-tap bookings.</p>
        </div>
        <Button onClick={startAdd} className="gap-2"><Plus className="w-4 h-4" /> Add Property</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Home className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
          <p className="text-muted-foreground mb-4">No properties yet. Add your first one.</p>
          <Button onClick={startAdd}>Add Property</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((p, i) => {
            const Icon = iconFor(p.type);
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 hover:shadow-lg transition">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
                <div className="relative flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">{p.name}</h3>
                      <p className="text-xs text-muted-foreground">{p.type} · {p.county || "—"}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
                <div className="relative mt-4 space-y-1 text-sm text-muted-foreground">
                  {p.address && <p className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {p.address}</p>}
                  {(p.bedrooms || p.floors) && (
                    <p className="text-xs">{p.bedrooms ? `${p.bedrooms} bedrooms` : ""}{p.bedrooms && p.floors ? " · " : ""}{p.floors ? `${p.floors} floors` : ""}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Property" : "Add Property"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Karen Home" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Type</label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="County" value={form.county} onChange={e => setForm({ ...form, county: e.target.value })} />
              <Input placeholder="Estate" value={form.estate} onChange={e => setForm({ ...form, estate: e.target.value })} />
            </div>
            <Input placeholder="Full address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            <Input placeholder="Google Maps URL" value={form.maps_url} onChange={e => setForm({ ...form, maps_url: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Bedrooms" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: e.target.value })} />
              <Input type="number" placeholder="Floors" value={form.floors} onChange={e => setForm({ ...form, floors: e.target.value })} />
            </div>
            <Input placeholder="Parking instructions" value={form.parking_notes} onChange={e => setForm({ ...form, parking_notes: e.target.value })} />
            <Input placeholder="Gate instructions" value={form.gate_notes} onChange={e => setForm({ ...form, gate_notes: e.target.value })} />
            <Textarea placeholder="Notes" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <Button className="w-full" onClick={save}>{editing ? "Save Changes" : "Add Property"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortalProperties;
