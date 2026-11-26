import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    businessName: "Concept Cleaning Services",
    phone: "+254796563741",
    currency: "KES",
    dateFormat: "DD/MM/YYYY",
  });
  const [discount, setDiscount] = useState("0");
  const [loadingDiscount, setLoadingDiscount] = useState(true);

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "discount_percentage")
      .single()
      .then(({ data }) => {
        if (data) setDiscount(data.value);
        setLoadingDiscount(false);
      });
  }, []);

  const handleSave = () => {
    toast.success("Settings saved!");
  };

  const saveDiscount = async () => {
    const val = parseFloat(discount);
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error("Discount must be between 0 and 100");
      return;
    }
    const { error } = await supabase
      .from("admin_settings")
      .update({ value: String(val), updated_at: new Date().toISOString() })
      .eq("key", "discount_percentage");
    if (error) {
      toast.error("Failed to save discount");
      return;
    }
    toast.success(`Global discount set to ${val}%`);
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h2 className="text-lg font-bold">Settings</h2>

      {/* Global Discount */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-sm">Global Discount</h3>
        <p className="text-xs text-muted-foreground">
          Set a discount percentage that applies to all service prices displayed on the website.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1.5 block">Discount (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              disabled={loadingDiscount}
              placeholder="0"
            />
          </div>
          <Button onClick={saveDiscount} disabled={loadingDiscount}>
            Save Discount
          </Button>
        </div>
        {parseFloat(discount) > 0 && (
          <p className="text-xs text-primary font-medium">
            All prices will show {discount}% off on the website.
          </p>
        )}
      </div>

      {/* Business Settings */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        <h3 className="font-semibold text-sm">Business Info</h3>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Business Name</label>
          <Input
            value={settings.businessName}
            onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Phone Number</label>
          <Input
            value={settings.phone}
            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Currency</label>
          <Input
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Date Format</label>
          <Input
            value={settings.dateFormat}
            onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Logo</label>
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
            Logo upload will be available with Cloud storage
          </div>
        </div>
        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </div>
  );
};

export default AdminSettings;
