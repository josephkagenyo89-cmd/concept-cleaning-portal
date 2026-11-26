import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const roles = ["Cleaner", "Supervisor", "Driver", "Manager", "Admin"];

const AdminHR = () => {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, any[]>>({});
  const [form, setForm] = useState({ name: "", phone: "", role: "Cleaner", id_number: "", notes: "" });

  const load = async () => {
    const { data } = await supabase.from("staff").select("*").order("name");
    setStaff(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) { toast.error("Name required"); return; }
    const payload = { name: form.name, phone: form.phone || null, role: form.role, id_number: form.id_number || null, notes: form.notes || null };
    if (editingId) {
      await supabase.from("staff").update(payload).eq("id", editingId);
      toast.success("Updated");
    } else {
      await supabase.from("staff").insert(payload);
      toast.success("Staff added");
    }
    setShowForm(false);
    setEditingId(null);
    setForm({ name: "", phone: "", role: "Cleaner", id_number: "", notes: "" });
    load();
  };

  const handleEdit = (s: any) => {
    setForm({ name: s.name, phone: s.phone ?? "", role: s.role, id_number: s.id_number ?? "", notes: s.notes ?? "" });
    setEditingId(s.id);
    setShowForm(true);
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!assignments[id]) {
      const { data } = await supabase
        .from("job_assignments")
        .select("*, bookings(booking_number, service, date, status)")
        .eq("staff_id", id)
        .order("created_at", { ascending: false });
      setAssignments((prev) => ({ ...prev, [id]: data ?? [] }));
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "Active" ? "Inactive" : "Active";
    await supabase.from("staff").update({ status: newStatus }).eq("id", id);
    setStaff(staff.map((s) => (s.id === id ? { ...s, status: newStatus } : s)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">HR / Staff</h2>
        <Button size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ name: "", phone: "", role: "Cleaner", id_number: "", notes: "" }); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Staff
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="ID Number" value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={save}>{editingId ? "Update" : "Add"}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {loading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
        {!loading && staff.length === 0 && <p className="p-4 text-sm text-muted-foreground">No staff yet.</p>}
        {staff.map((s) => (
          <div key={s.id}>
            <button onClick={() => toggleExpand(s.id)} className="w-full p-4 flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors text-left">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{s.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {s.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{s.role} · {s.phone ?? "—"}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggleStatus(s.id, s.status); }} className="text-xs">
                  {s.status === "Active" ? "Deactivate" : "Activate"}
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEdit(s); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={async (e) => {
                  e.stopPropagation();
                  await supabase.from("staff").delete().eq("id", s.id);
                  load();
                }}><Trash2 className="w-4 h-4" /></Button>
                {expandedId === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>
            {expandedId === s.id && (
              <div className="px-4 pb-4">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Job Assignments</p>
                {(assignments[s.id] ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No assignments yet.</p>
                ) : (
                  <div className="space-y-1">
                    {(assignments[s.id] ?? []).map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-xs">
                        <span>{(a.bookings as any)?.booking_number} · {(a.bookings as any)?.service}</span>
                        <span className="text-muted-foreground">{(a.bookings as any)?.status} · {(a.bookings as any)?.date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminHR;
