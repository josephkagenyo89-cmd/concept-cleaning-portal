import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { loadAllSettings, saveSettings, AllSettings, DEFAULT_SETTINGS } from '@/lib/settings';
import { setPdfSettings } from '@/lib/documentPdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, RotateCcw, Lock, Settings as SettingsIcon, History } from 'lucide-react';

type AuditEntry = {
  id: string;
  created_at: string;
  action: string;
  details: any;
  admin_id: string;
};

export default function AdminSettings() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const canEdit = isSuperAdmin;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [s, setS] = useState<AllSettings>(DEFAULT_SETTINGS);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    (async () => {
      const data = await loadAllSettings(true);
      setS(data);
      setLoading(false);
      loadAudit();
    })();
  }, []);

  const loadAudit = async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('id, created_at, action, details, admin_id')
      .eq('target_type', 'system_settings')
      .order('created_at', { ascending: false })
      .limit(30);
    setAudit((data as any[]) || []);
  };

  const persist = async <K extends keyof AllSettings>(category: K, value: AllSettings[K]) => {
    if (!canEdit) {
      toast({ title: 'Read-only', description: 'Only Super Admins can change settings.', variant: 'destructive' });
      return;
    }
    setSaving(category);
    try {
      await saveSettings(category, value);
      const fresh = await loadAllSettings(true);
      setS(fresh);
      setPdfSettings(fresh);
      toast({ title: 'Saved', description: `${category} settings updated.` });
      loadAudit();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const resetCategory = async <K extends keyof AllSettings>(category: K) => {
    if (!canEdit) return;
    if (!confirm(`Reset ${category} settings to defaults? This cannot be undone.`)) return;
    await persist(category, DEFAULT_SETTINGS[category]);
    setS(prev => ({ ...prev, [category]: DEFAULT_SETTINGS[category] }));
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Lock className="h-12 w-12 text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground">You do not have permission to view system settings.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><SettingsIcon className="h-6 w-6" /> System Settings</h1>
          <p className="text-sm text-muted-foreground">Centralized configuration for the entire application.</p>
        </div>
        {canEdit ? (
          <Badge variant="default">Super Admin · full access</Badge>
        ) : (
          <Badge variant="secondary">Admin · read-only</Badge>
        )}
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-muted p-1">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="document">Documents</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
          <TabsTrigger value="commission">Commission</TabsTrigger>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="audit"><History className="h-3.5 w-3.5 mr-1" /> Audit</TabsTrigger>
        </TabsList>

        {/* GENERAL */}
        <TabsContent value="general">
          <Card>
            <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Company Name" value={s.general.company_name} disabled={!canEdit}
                  onChange={v => setS({ ...s, general: { ...s.general, company_name: v } })} />
                <Field label="Phone" value={s.general.phone} disabled={!canEdit}
                  onChange={v => setS({ ...s, general: { ...s.general, phone: v } })} />
                <Field label="Email" value={s.general.email} disabled={!canEdit}
                  onChange={v => setS({ ...s, general: { ...s.general, email: v } })} />
                <Field label="Website" value={s.general.website} disabled={!canEdit}
                  onChange={v => setS({ ...s, general: { ...s.general, website: v } })} />
                <Field label="Logo URL" value={s.general.logo_url} disabled={!canEdit}
                  onChange={v => setS({ ...s, general: { ...s.general, logo_url: v } })} />
                <Field label="Address" value={s.general.address} disabled={!canEdit}
                  onChange={v => setS({ ...s, general: { ...s.general, address: v } })} />
              </div>
              <SaveBar disabled={!canEdit} saving={saving === 'general'}
                onSave={() => persist('general', s.general)} onReset={() => resetCategory('general')} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENT */}
        <TabsContent value="document">
          <Card>
            <CardHeader><CardTitle>Document Branding</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Primary color</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input type="color" value={s.document.primary_color} disabled={!canEdit} className="w-16 h-10 p-1"
                      onChange={e => setS({ ...s, document: { ...s.document, primary_color: e.target.value } })} />
                    <Input value={s.document.primary_color} disabled={!canEdit}
                      onChange={e => setS({ ...s, document: { ...s.document, primary_color: e.target.value } })} />
                  </div>
                </div>
                <Field label="Footer text" value={s.document.footer_text} disabled={!canEdit}
                  onChange={v => setS({ ...s, document: { ...s.document, footer_text: v } })} />
              </div>
              <div>
                <Label>Terms & Conditions</Label>
                <Textarea rows={6} value={s.document.terms_conditions} disabled={!canEdit}
                  onChange={e => setS({ ...s, document: { ...s.document, terms_conditions: e.target.value } })} />
                <p className="text-xs text-muted-foreground mt-1">Shown on quotations, invoices, receipts. Use new lines for separate clauses.</p>
              </div>
              <SaveBar disabled={!canEdit} saving={saving === 'document'}
                onSave={() => persist('document', s.document)} onReset={() => resetCategory('document')} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* PAYMENT */}
        <TabsContent value="payment">
          <Card>
            <CardHeader><CardTitle>Payment Details (shown on invoices/receipts)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="M-Pesa Paybill" value={s.payment.mpesa_paybill} disabled={!canEdit}
                  onChange={v => setS({ ...s, payment: { ...s.payment, mpesa_paybill: v } })} />
                <Field label="M-Pesa Account" value={s.payment.mpesa_account} disabled={!canEdit}
                  onChange={v => setS({ ...s, payment: { ...s.payment, mpesa_account: v } })} />
                <Field label="M-Pesa Till" value={s.payment.mpesa_till} disabled={!canEdit}
                  onChange={v => setS({ ...s, payment: { ...s.payment, mpesa_till: v } })} />
              </div>
              <Separator />
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Bank Name" value={s.payment.bank_name} disabled={!canEdit}
                  onChange={v => setS({ ...s, payment: { ...s.payment, bank_name: v } })} />
                <Field label="Bank Branch" value={s.payment.bank_branch} disabled={!canEdit}
                  onChange={v => setS({ ...s, payment: { ...s.payment, bank_branch: v } })} />
                <Field label="Account Name" value={s.payment.bank_account_name} disabled={!canEdit}
                  onChange={v => setS({ ...s, payment: { ...s.payment, bank_account_name: v } })} />
                <Field label="Account Number" value={s.payment.bank_account_number} disabled={!canEdit}
                  onChange={v => setS({ ...s, payment: { ...s.payment, bank_account_number: v } })} />
              </div>
              <SaveBar disabled={!canEdit} saving={saving === 'payment'}
                onSave={() => persist('payment', s.payment)} onReset={() => resetCategory('payment')} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAX */}
        <TabsContent value="tax">
          <Card>
            <CardHeader><CardTitle>Tax (VAT)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Enable VAT</Label>
                  <p className="text-xs text-muted-foreground">When enabled, VAT is added to invoices and quotations.</p>
                </div>
                <Switch checked={s.tax.vat_enabled} disabled={!canEdit}
                  onCheckedChange={v => setS({ ...s, tax: { ...s.tax, vat_enabled: v } })} />
              </div>
              <div>
                <Label>VAT Percentage (%)</Label>
                <Input type="number" min={0} max={100} step="0.01" value={s.tax.vat_percentage}
                  disabled={!canEdit || !s.tax.vat_enabled}
                  onChange={e => setS({ ...s, tax: { ...s.tax, vat_percentage: Number(e.target.value) } })} />
              </div>
              <SaveBar disabled={!canEdit} saving={saving === 'tax'}
                onSave={() => persist('tax', s.tax)} onReset={() => resetCategory('tax')} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* COMMISSION */}
        <TabsContent value="commission">
          <Card>
            <CardHeader><CardTitle>Commission Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Commission Type</Label>
                <select className="w-full border rounded-md h-10 px-3 bg-background mt-1"
                  value={s.commission.type} disabled={!canEdit}
                  onChange={e => setS({ ...s, commission: { ...s.commission, type: e.target.value as any } })}>
                  <option value="tiered">Tiered (Bronze / Silver / Gold) — current default</option>
                  <option value="fixed">Fixed amount per booking</option>
                  <option value="percentage">Percentage of booking amount</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Tiered keeps existing logic intact. Switching applies on next commission calculation only — historical commissions are unchanged.
                </p>
              </div>
              {s.commission.type === 'fixed' && (
                <div>
                  <Label>Fixed amount (Ksh)</Label>
                  <Input type="number" value={s.commission.fixed_amount} disabled={!canEdit}
                    onChange={e => setS({ ...s, commission: { ...s.commission, fixed_amount: Number(e.target.value) } })} />
                </div>
              )}
              {s.commission.type === 'percentage' && (
                <div>
                  <Label>Percentage (%)</Label>
                  <Input type="number" step="0.01" value={s.commission.percentage} disabled={!canEdit}
                    onChange={e => setS({ ...s, commission: { ...s.commission, percentage: Number(e.target.value) } })} />
                </div>
              )}
              <SaveBar disabled={!canEdit} saving={saving === 'commission'}
                onSave={() => persist('commission', s.commission)} onReset={() => resetCategory('commission')} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* CRM */}
        <TabsContent value="crm">
          <Card>
            <CardHeader><CardTitle>CRM Thresholds</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>VIP threshold (Ksh)</Label>
                  <Input type="number" value={s.crm.vip_threshold} disabled={!canEdit}
                    onChange={e => setS({ ...s, crm: { ...s.crm, vip_threshold: Number(e.target.value) } })} />
                </div>
                <div>
                  <Label>Inactive after (days)</Label>
                  <Input type="number" value={s.crm.inactive_days} disabled={!canEdit}
                    onChange={e => setS({ ...s, crm: { ...s.crm, inactive_days: Number(e.target.value) } })} />
                </div>
                <div>
                  <Label>Follow-up interval (days)</Label>
                  <Input type="number" value={s.crm.followup_days} disabled={!canEdit}
                    onChange={e => setS({ ...s, crm: { ...s.crm, followup_days: Number(e.target.value) } })} />
                </div>
              </div>
              <SaveBar disabled={!canEdit} saving={saving === 'crm'}
                onSave={() => persist('crm', s.crm)} onReset={() => resetCategory('crm')} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SYSTEM */}
        <TabsContent value="system">
          <Card>
            <CardHeader><CardTitle>System Defaults</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Currency" value={s.system.currency} disabled={!canEdit}
                  onChange={v => setS({ ...s, system: { ...s.system, currency: v } })} />
                <div>
                  <Label>Date format</Label>
                  <select className="w-full border rounded-md h-10 px-3 bg-background mt-1"
                    value={s.system.date_format} disabled={!canEdit}
                    onChange={e => setS({ ...s, system: { ...s.system, date_format: e.target.value } })}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label>Auto numbering</Label>
                    <p className="text-xs text-muted-foreground">Auto-generate document numbers.</p>
                  </div>
                  <Switch checked={s.system.auto_numbering} disabled={!canEdit}
                    onCheckedChange={v => setS({ ...s, system: { ...s.system, auto_numbering: v } })} />
                </div>
              </div>
              <SaveBar disabled={!canEdit} saving={saving === 'system'}
                onSave={() => persist('system', s.system)} onReset={() => resetCategory('system')} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* NOTIFICATIONS */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>WhatsApp Message Templates</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Available placeholders: <code>{'{client_name}'}</code>, <code>{'{link}'}</code>, <code>{'{invoice_number}'}</code>, <code>{'{quotation_number}'}</code>, <code>{'{amount}'}</code>
              </p>
              <div>
                <Label>Signature request template</Label>
                <Textarea rows={3} value={s.notifications.whatsapp_signature_template} disabled={!canEdit}
                  onChange={e => setS({ ...s, notifications: { ...s.notifications, whatsapp_signature_template: e.target.value } })} />
              </div>
              <div>
                <Label>Invoice template</Label>
                <Textarea rows={3} value={s.notifications.whatsapp_invoice_template} disabled={!canEdit}
                  onChange={e => setS({ ...s, notifications: { ...s.notifications, whatsapp_invoice_template: e.target.value } })} />
              </div>
              <div>
                <Label>Quotation template</Label>
                <Textarea rows={3} value={s.notifications.whatsapp_quotation_template} disabled={!canEdit}
                  onChange={e => setS({ ...s, notifications: { ...s.notifications, whatsapp_quotation_template: e.target.value } })} />
              </div>
              <SaveBar disabled={!canEdit} saving={saving === 'notifications'}
                onSave={() => persist('notifications', s.notifications)} onReset={() => resetCategory('notifications')} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* INTEGRATIONS */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader><CardTitle>Business Integrations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Google Business Review URL</Label>
                <Input
                  value={s.integrations.google_review_url}
                  disabled={!canEdit}
                  placeholder="https://g.page/r/your-business/review"
                  onChange={e => setS({ ...s, integrations: { ...s.integrations, google_review_url: e.target.value } })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used to redirect satisfied customers (4–5★ ratings) to leave a Google review. Get this link from your Google Business Profile.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" type="button" disabled={!s.integrations.google_review_url}
                  onClick={() => {
                    const url = s.integrations.google_review_url.trim();
                    if (!url) return;
                    if (!/^https?:\/\//i.test(url)) {
                      toast({ title: 'Invalid URL', description: 'Must start with http(s)://', variant: 'destructive' });
                      return;
                    }
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}>
                  Test Google Review Link
                </Button>
              </div>
              <SaveBar disabled={!canEdit} saving={saving === 'integrations'}
                onSave={() => persist('integrations', s.integrations)} onReset={() => resetCategory('integrations')} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle>Recent Settings Changes</CardTitle></CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {audit.map(a => (
                    <div key={a.id} className="border rounded-lg p-3 text-sm">
                      <div className="flex justify-between gap-2 flex-wrap">
                        <span className="font-medium capitalize">
                          {a.details?.category || 'unknown'} · {a.action.replace('settings.', '')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">By admin: {a.admin_id.slice(0, 8)}…</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value || ''} disabled={disabled} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function SaveBar({ onSave, onReset, saving, disabled }: { onSave: () => void; onReset: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="outline" onClick={onReset} disabled={disabled || saving}>
        <RotateCcw className="h-4 w-4 mr-1" /> Reset to defaults
      </Button>
      <Button onClick={onSave} disabled={disabled || saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
        Save changes
      </Button>
    </div>
  );
}
