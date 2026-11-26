import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const categories = ["Cleaning", "Fumigation", "Car Detailing", "Maintenance", "Package"];
const priceTypes = [
  { value: "fixed", label: "Fixed Price" },
  { value: "range", label: "Price Range" },
  { value: "per_sqm", label: "Per Square Meter" },
  { value: "custom", label: "Custom Quote" },
];

const AdminServices = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", slug: "", description: "", category: "Cleaning",
    price_type: "fixed", price_value: "", price_max: "",
    image_url: "", meta_title: "", meta_description: "", keywords: "",
  });

  const load = async () => {
    const { data } = await supabase.from("services").select("*").order("sort_order");
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSave = async () => {
    if (!form.name) { toast.error("Service name is required"); return; }
    const slug = form.slug || generateSlug(form.name);
    const payload = {
      name: form.name,
      slug,
      description: form.description || null,
      category: form.category,
      price_type: form.price_type,
      price_value: Number(form.price_value) || 0,
      price_max: form.price_max ? Number(form.price_max) : null,
      image_url: form.image_url || null,
      meta_title: form.meta_title || form.name,
      meta_description: form.meta_description || null,
      keywords: form.keywords || null,
    };

    if (editingId) {
      const { error } = await supabase.from("services").update(payload).eq("id", editingId);
      if (error) { toast.error("Update failed"); return; }
      toast.success("Service updated");
    } else {
      const { error } = await supabase.from("services").insert({ ...payload, sort_order: items.length + 1 });
      if (error) { toast.error(error.message); return; }
      toast.success("Service added");
    }
    resetForm();
    load();
  };

  const resetForm = () => {
    setForm({ name: "", slug: "", description: "", category: "Cleaning", price_type: "fixed", price_value: "", price_max: "", image_url: "", meta_title: "", meta_description: "", keywords: "" });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (s: any) => {
    setForm({
      name: s.name, slug: s.slug, description: s.description ?? "", category: s.category,
      price_type: s.price_type, price_value: String(s.price_value), price_max: s.price_max ? String(s.price_max) : "",
      image_url: s.image_url ?? "", meta_title: s.meta_title ?? "", meta_description: s.meta_description ?? "", keywords: s.keywords ?? "",
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    setItems(items.filter((i) => i.id !== id));
    toast.success("Deleted");
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("services").update({ is_active: !current }).eq("id", id);
    setItems(items.map((i) => (i.id === id ? { ...i, is_active: !current } : i)));
  };

  const formatPrice = (s: any) => {
    if (s.price_type === "custom") return "Custom Quote";
    if (s.price_type === "per_sqm") return `KES ${Number(s.price_value).toLocaleString()}/sqm`;
    if (s.price_type === "range") return `KES ${Number(s.price_value).toLocaleString()} – ${s.price_max ? Number(s.price_max).toLocaleString() : "..."}`;
    return `KES ${Number(s.price_value).toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Services & Pricing</h2>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Service
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">URL Slug</label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Price Type</label>
              <Select value={form.price_type} onValueChange={(v) => setForm({ ...form, price_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priceTypes.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Price (KES)</label>
              <div className="flex gap-2">
                <Input type="number" value={form.price_value} onChange={(e) => setForm({ ...form, price_value: e.target.value })} placeholder="Min / Fixed" />
                {form.price_type === "range" && (
                  <Input type="number" value={form.price_max} onChange={(e) => setForm({ ...form, price_max: e.target.value })} placeholder="Max" />
                )}
              </div>
            </div>
          </div>
          <details className="group">
            <summary className="text-sm font-medium cursor-pointer text-primary">SEO Fields (optional)</summary>
            <div className="mt-3 space-y-3">
              <Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder="Meta Title" />
              <Textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} placeholder="Meta Description" rows={2} />
              <Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="Keywords (comma separated)" />
            </div>
          </details>
          <div className="flex gap-2">
            <Button onClick={handleSave}>{editingId ? "Update" : "Add Service"}</Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {loading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
        {!loading && items.length === 0 && <p className="p-4 text-sm text-muted-foreground">No services yet.</p>}
        {items.map((s) => (
          <div key={s.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{s.name}</p>
                {!s.is_active && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Inactive</span>}
              </div>
              <p className="text-xs text-muted-foreground">{s.category} · {formatPrice(s)}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => toggleActive(s.id, s.is_active)} className="text-xs">
                {s.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminServices;
