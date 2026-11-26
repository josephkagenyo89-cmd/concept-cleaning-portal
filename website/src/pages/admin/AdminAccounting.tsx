import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

const expenseCategories = ["Supplies", "Transport", "Equipment", "Salaries", "Utilities", "Marketing", "General"];

const AdminAccounting = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", category: "General", date: format(new Date(), "yyyy-MM-dd"), notes: "" });

  const load = async () => {
    const [e, i] = await Promise.all([
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("invoices").select("*").eq("status", "Paid"),
    ]);
    setExpenses(e.data ?? []);
    setInvoices(i.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalIncome = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const profit = totalIncome - totalExpenses;

  const saveExpense = async () => {
    if (!form.description || !form.amount) { toast.error("Fill required fields"); return; }
    const { error } = await supabase.from("expenses").insert({
      description: form.description,
      amount: Number(form.amount),
      category: form.category,
      date: form.date,
      notes: form.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Expense added");
    setShowForm(false);
    setForm({ description: "", amount: "", category: "General", date: format(new Date(), "yyyy-MM-dd"), notes: "" });
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
    await supabase.from("expenses").update(update).eq("id", id);
    setExpenses(expenses.map((e) => (e.id === id ? { ...e, ...update } : e)));
    toast.success(`Expense ${status}`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Accounting</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-2xl font-bold">KES {totalIncome.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Income (Paid)</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-lg bg-red-100 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-red-700" />
          </div>
          <div>
            <p className="text-2xl font-bold">KES {totalExpenses.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Expenses</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${profit >= 0 ? "bg-emerald-100" : "bg-red-100"}`}>
            {profit >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-700" /> : <TrendingDown className="w-5 h-5 text-red-700" />}
          </div>
          <div>
            <p className="text-2xl font-bold">KES {profit.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Net Profit</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Expenses</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> Add Expense
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input placeholder="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input type="number" placeholder="Amount *" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {expenseCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <div className="flex gap-2">
            <Button onClick={saveExpense}>Save</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Approval</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Loading...</td></tr>}
            {!loading && expenses.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No expenses yet.</td></tr>}
            {expenses.map((e) => (
              <tr key={e.id}>
                <td className="p-3 font-medium">{e.description}</td>
                <td className="p-3 text-muted-foreground">{e.category}</td>
                <td className="p-3 font-semibold">KES {Number(e.amount).toLocaleString()}</td>
                <td className="p-3 text-muted-foreground">{e.date}</td>
                <td className="p-3">
                  <Select value={e.approval_status} onValueChange={(v) => updateApproval(e.id, v)}>
                    <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Pending", "Approved", "Rejected"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                    await supabase.from("expenses").delete().eq("id", e.id);
                    load();
                  }}><Trash2 className="w-4 h-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminAccounting;
