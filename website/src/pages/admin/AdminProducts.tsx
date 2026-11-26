import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  additional_images: string[] | null;
  category: string;
  is_active: boolean;
  sort_order: number;
}

const empty: Omit<Product, "id"> = {
  name: "",
  description: "",
  price: 0,
  image_url: "",
  additional_images: [],
  category: "Cleaning",
  is_active: true,
  sort_order: 0,
};

const AdminProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const { toast } = useToast();

  const load = () => {
    supabase
      .from("products")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setProducts((data as Product[]) ?? []));
  };

  useEffect(load, []);

  const save = async () => {
    if (!editing) return;
    const additionalImgs = (editing.additional_images || []).filter((u) => u.trim());
    const payload = {
      name: editing.name,
      description: editing.description,
      price: editing.price,
      image_url: editing.image_url || null,
      additional_images: additionalImgs,
      category: editing.category,
      is_active: editing.is_active,
      sort_order: editing.sort_order,
    };

    if (isNew) {
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }

    toast({ title: isNew ? "Product added" : "Product updated" });
    setEditing(null);
    setIsNew(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    await supabase.from("products").delete().eq("id", id);
    toast({ title: "Product deleted" });
    load();
  };

  const updateAdditionalImage = (index: number, value: string) => {
    if (!editing) return;
    const imgs = [...(editing.additional_images || [])];
    imgs[index] = value;
    setEditing({ ...editing, additional_images: imgs });
  };

  const addAdditionalImage = () => {
    if (!editing) return;
    const imgs = [...(editing.additional_images || [])];
    if (imgs.length >= 3) return;
    imgs.push("");
    setEditing({ ...editing, additional_images: imgs });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Products</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing({ id: "", ...empty } as Product);
            setIsNew(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Product
        </Button>
      </div>

      {editing && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{isNew ? "New Product" : "Edit Product"}</CardTitle>
            <button onClick={() => { setEditing(null); setIsNew(false); }} className="p-1 rounded hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Input placeholder="Description" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Price (KES)" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} />
              <Input type="number" placeholder="Sort Order" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </div>
            <Input placeholder="Main Image URL" value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} />
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Additional Images (up to 3)</p>
              {(editing.additional_images || []).map((url, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Image URL ${i + 1}`}
                    value={url}
                    onChange={(e) => updateAdditionalImage(i, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const imgs = [...(editing.additional_images || [])];
                      imgs.splice(i, 1);
                      setEditing({ ...editing, additional_images: imgs });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {(editing.additional_images || []).length < 3 && (
                <Button size="sm" variant="outline" onClick={addAdditionalImage}>
                  <Plus className="w-3 h-3 mr-1" /> Add Image
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Active
              </label>
            </div>
            <Button onClick={save}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                KES {Number(p.price).toLocaleString()} {!p.is_active && "• Inactive"}
                {(p.additional_images?.length ?? 0) > 0 && ` • ${p.additional_images!.length} extra images`}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setIsNew(false); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminProducts;
