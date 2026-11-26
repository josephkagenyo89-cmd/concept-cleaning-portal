import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PortalProfile = () => {
  const { profile, user, refreshProfile } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "", address: "", county: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      address: profile.address ?? "",
      county: profile.county ?? "",
      notes: (profile as any).notes ?? "",
    });
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("clients").update({ full_name: form.full_name, phone: form.phone, location: form.address, county: form.county, whatsapp_number: form.phone, notes: form.notes || null }).eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    toast.success("Profile updated");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-primary">Account Settings</h1>
      <form onSubmit={save} className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Email</label>
          <Input value={user?.email ?? ""} disabled className="mt-1" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Full name</label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="mt-1" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Phone</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Address</label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">County</label>
          <Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} className="mt-1" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Notes</label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" rows={3} />
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </form>
    </div>
  );
};

export default PortalProfile;
