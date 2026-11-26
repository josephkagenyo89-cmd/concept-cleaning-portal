import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Star, StarOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminPortfolio = () => {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "", location: "",
    before_image_url: "", after_image_url: "",
    booking_id: "", client_id: "", featured: false,
  });

  const load = async () => {
    const [posts, svcs] = await Promise.all([
      supabase.from("portfolio_posts").select("*, clients(name)").order("created_at", { ascending: false }),
      supabase.from("services").select("category").eq("is_active", true),
    ]);
    setItems(posts.data ?? []);
    setCategories([...new Set((svcs.data ?? []).map((s: any) => s.category))]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const bookingId = searchParams.get("booking_id");
    if (bookingId) {
      setForm((f) => ({
        ...f, booking_id: bookingId,
        client_id: searchParams.get("client_id") ?? "",
        category: searchParams.get("service") ?? "",
        title: `${searchParams.get("service") ?? ""} - ${searchParams.get("client_name") ?? ""}`,
      }));
      setShowForm(true);
    }
  }, [searchParams]);

  const uploadImage = async (file: File, prefix: string): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("portfolio").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("portfolio").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "before_image_url" | "after_image_url") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, field === "before_image_url" ? "before" : "after");
      setForm((f) => ({ ...f, [field]: url }));
      toast.success("Image uploaded");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.title || !form.category) { toast.error("Fill required fields"); return; }
    const payload = {
      title: form.title, description: form.description || null,
      category: form.category, location: form.location || null,
      before_image_url: form.before_image_url || null,
      after_image_url: form.after_image_url || null,
      booking_id: form.booking_id || null,
      client_id: form.client_id || null, featured: form.featured,
    };
    if (editingId) {
      const { error } = await supabase.from("portfolio_posts").update(payload).eq("id", editingId);
      if (error) { toast.error("Update failed"); return; }
      toast.success("Post updated");
    } else {
      const { error } = await supabase.from("portfolio_posts").insert(payload);
      if (error) { toast.error("Failed to save"); return; }
      toast.success("Post published!");
    }
    resetForm();
    load();
  };

  const resetForm = () => {
    setForm({ title: "", description: "", category: "", location: "", before_image_url: "", after_image_url: "", booking_id: "", client_id: "", featured: false });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (item: any) => {
    setForm({ title: item.title, description: item.description ?? "", category: item.category, location: item.location ?? "", before_image_url: item.before_image_url ?? "", after_image_url: item.after_image_url ?? "", booking_id: item.booking_id ?? "", client_id: item.client_id ?? "", featured: item.featured });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("portfolio_posts").delete().eq("id", id);
    setItems(items.filter((i) => i.id !== id));
    toast.success("Deleted");
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    await supabase.from("portfolio_posts").update({ featured: !current }).eq("id", id);
    setItems(items.map((i) => (i.id === id ? { ...i, featured: !current } : i)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Portfolio / Post Work</h2>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Post
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title *</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Project title" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Category *</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Location</label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Westlands" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="rounded" />
              <label className="text-sm font-medium">Featured post</label>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the work..." rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Before Image</label>
              <Input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "before_image_url")} disabled={uploading} />
              {form.before_image_url && <img src={form.before_image_url} alt="" className="mt-2 w-20 h-20 rounded-lg object-cover" />}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">After Image</label>
              <Input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "after_image_url")} disabled={uploading} />
              {form.after_image_url && <img src={form.after_image_url} alt="" className="mt-2 w-20 h-20 rounded-lg object-cover" />}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={uploading}>{editingId ? "Update" : "Publish Post"}</Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {loading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
        {!loading && items.length === 0 && <p className="p-4 text-sm text-muted-foreground">No portfolio posts yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {item.after_image_url && <img src={item.after_image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.category} · {new Date(item.created_at).toLocaleDateString()}
                  {(item.clients as any)?.name ? ` · ${(item.clients as any).name}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => toggleFeatured(item.id, item.featured)}>
                {item.featured ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : <StarOff className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleEdit(item)} className="text-xs">Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPortfolio;
