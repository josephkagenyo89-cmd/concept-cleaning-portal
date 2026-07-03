import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  BookingModuleSettings,
  DEFAULT_BOOKING_SETTINGS,
  loadBookingSettings,
  saveBookingSettings,
  resetBookingSettings,
} from '@/lib/bookingSettings';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: (s: BookingModuleSettings) => void;
}

const ROLES = ['agent', 'admin', 'super_admin'] as const;

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function RoleChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (r: string) => {
    onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  };
  return (
    <div className="flex gap-1">
      {ROLES.map((r) => (
        <button
          type="button"
          key={r}
          onClick={() => toggle(r)}
          className={`text-xs px-2 py-1 rounded border ${value.includes(r) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}
        >
          {r.replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}

export default function BookingSettingsDialog({ open, onOpenChange, onSaved }: Props) {
  const [s, setS] = useState<BookingModuleSettings>(DEFAULT_BOOKING_SETTINGS);

  useEffect(() => { if (open) setS(loadBookingSettings()); }, [open]);

  const upd = <K extends keyof BookingModuleSettings>(k: K, patch: Partial<BookingModuleSettings[K]>) =>
    setS((prev) => ({ ...prev, [k]: { ...(prev[k] as any), ...patch } }));

  const handleSave = () => {
    saveBookingSettings(s);
    toast({ title: 'Booking settings saved', description: 'Applies only to the Book Service module.' });
    onSaved?.(s);
    onOpenChange(false);
  };

  const handleReset = () => {
    resetBookingSettings();
    setS(DEFAULT_BOOKING_SETTINGS);
    toast({ title: 'Reset to defaults' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle>Booking Settings</DialogTitle>
          <p className="text-xs text-muted-foreground">Configuration applies only to the Book Service module.</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted p-1">
              {['general','client','service','discount','payment','documents','workflow','ui','permissions'].map((t) => (
                <TabsTrigger key={t} value={t} className="capitalize text-xs">{t}</TabsTrigger>
              ))}
            </TabsList>

            {/* GENERAL */}
            <TabsContent value="general" className="mt-4 space-y-1">
              <Row label="Booking Prefix">
                <Input className="w-40" value={s.general.bookingPrefix} onChange={(e) => upd('general', { bookingPrefix: e.target.value })} />
              </Row>
              <Row label="Booking Number Format" hint="Tokens: {PREFIX} {YYYY} {SEQ}">
                <Input className="w-60" value={s.general.bookingNumberFormat} onChange={(e) => upd('general', { bookingNumberFormat: e.target.value })} />
              </Row>
              <Row label="Default Booking Status">
                <Select value={s.general.defaultStatus} onValueChange={(v: any) => upd('general', { defaultStatus: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Default Booking Date">
                <Select value={s.general.defaultDate} onValueChange={(v: any) => upd('general', { defaultDate: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="tomorrow">Tomorrow</SelectItem>
                    <SelectItem value="none">Empty</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Default Currency">
                <Input className="w-32" value={s.general.currency} onChange={(e) => upd('general', { currency: e.target.value })} />
              </Row>
              <Row label="Date Format">
                <Select value={s.general.dateFormat} onValueChange={(v) => upd('general', { dateFormat: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Time Format">
                <Select value={s.general.timeFormat} onValueChange={(v: any) => upd('general', { timeFormat: v })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24-hour</SelectItem>
                    <SelectItem value="12h">12-hour</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </TabsContent>

            {/* CLIENT */}
            <TabsContent value="client" className="mt-4 space-y-1">
              {([
                ['requireClientId', 'Require Client ID before booking'],
                ['searchById', 'Search by Client ID'],
                ['searchByPhone', 'Search by Phone Number'],
                ['autoFetchFromCrm', 'Auto-fetch client from CRM'],
                ['allowWalkIn', 'Allow walk-in customers'],
                ['preventDuplicatePhone', 'Prevent duplicate phone numbers'],
              ] as const).map(([k, label]) => (
                <Row key={k} label={label}>
                  <Switch checked={(s.client as any)[k]} onCheckedChange={(v) => upd('client', { [k]: v } as any)} />
                </Row>
              ))}
            </TabsContent>

            {/* SERVICE */}
            <TabsContent value="service" className="mt-4 space-y-1">
              <Row label="Enable Multiple Services"><Switch checked={s.service.enableMultiple} onCheckedChange={(v) => upd('service', { enableMultiple: v })} /></Row>
              <Row label="Default Quantity"><Input type="number" className="w-24" value={s.service.defaultQuantity} onChange={(e) => upd('service', { defaultQuantity: Number(e.target.value) })} /></Row>
              <Row label="Default Unit"><Input className="w-40" value={s.service.defaultUnit} onChange={(e) => upd('service', { defaultUnit: e.target.value })} /></Row>
              <Row label="Enable VAT"><Switch checked={s.service.enableVat} onCheckedChange={(v) => upd('service', { enableVat: v })} /></Row>
              <Row label="Default VAT Rate (%)"><Input type="number" className="w-24" value={s.service.defaultVatRate} onChange={(e) => upd('service', { defaultVatRate: Number(e.target.value) })} /></Row>
              <Row label="Enable Discounts"><Switch checked={s.service.enableDiscounts} onCheckedChange={(v) => upd('service', { enableDiscounts: v })} /></Row>
              <Row label="Default Discount Type">
                <Select value={s.service.defaultDiscountType} onValueChange={(v: any) => upd('service', { defaultDiscountType: v })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </TabsContent>

            {/* DISCOUNT */}
            <TabsContent value="discount" className="mt-4 space-y-1">
              <Row label="Require Discount Approval"><Switch checked={s.discount.requireApproval} onCheckedChange={(v) => upd('discount', { requireApproval: v })} /></Row>
              <Row label="Maximum Discount Percentage"><Input type="number" className="w-24" value={s.discount.maxPercent} onChange={(e) => upd('discount', { maxPercent: Number(e.target.value) })} /></Row>
              <Row label="Maximum Discount Amount"><Input type="number" className="w-32" value={s.discount.maxAmount} onChange={(e) => upd('discount', { maxAmount: Number(e.target.value) })} /></Row>
              <Row label="Mandatory Discount Reason"><Switch checked={s.discount.mandatoryReason} onCheckedChange={(v) => upd('discount', { mandatoryReason: v })} /></Row>
              <Row label="Allow Salesperson Discounts"><Switch checked={s.discount.allowSalespersonDiscounts} onCheckedChange={(v) => upd('discount', { allowSalespersonDiscounts: v })} /></Row>
              <Row label="Admin Approval Required"><Switch checked={s.discount.adminApprovalRequired} onCheckedChange={(v) => upd('discount', { adminApprovalRequired: v })} /></Row>
              <Row label="Super Admin Override"><Switch checked={s.discount.superAdminOverride} onCheckedChange={(v) => upd('discount', { superAdminOverride: v })} /></Row>
            </TabsContent>

            {/* PAYMENT */}
            <TabsContent value="payment" className="mt-4 space-y-1">
              <Row label="Default Payment Terms"><Input className="w-60" value={s.payment.defaultTerms} onChange={(e) => upd('payment', { defaultTerms: e.target.value })} /></Row>
              <Row label="Allow Deposits"><Switch checked={s.payment.allowDeposits} onCheckedChange={(v) => upd('payment', { allowDeposits: v })} /></Row>
              <Row label="Require Deposit"><Switch checked={s.payment.requireDeposit} onCheckedChange={(v) => upd('payment', { requireDeposit: v })} /></Row>
              <Row label="Enable Balance Tracking"><Switch checked={s.payment.enableBalanceTracking} onCheckedChange={(v) => upd('payment', { enableBalanceTracking: v })} /></Row>
            </TabsContent>

            {/* DOCUMENTS */}
            <TabsContent value="documents" className="mt-4 space-y-1">
              <Row label="Auto-generate Quotation"><Switch checked={s.documents.autoQuotation} onCheckedChange={(v) => upd('documents', { autoQuotation: v })} /></Row>
              <Row label="Auto-generate Invoice"><Switch checked={s.documents.autoInvoice} onCheckedChange={(v) => upd('documents', { autoInvoice: v })} /></Row>
              <Row label="Auto-generate Receipt"><Switch checked={s.documents.autoReceipt} onCheckedChange={(v) => upd('documents', { autoReceipt: v })} /></Row>
              <Row label="Auto-generate Service Completion Certificate"><Switch checked={s.documents.autoCertificate} onCheckedChange={(v) => upd('documents', { autoCertificate: v })} /></Row>
              <Row label="Booking PDF Template">
                <Select value={s.documents.pdfTemplate} onValueChange={(v: any) => upd('documents', { pdfTemplate: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Show Company Logo"><Switch checked={s.documents.showLogo} onCheckedChange={(v) => upd('documents', { showLogo: v })} /></Row>
              <Row label="Show Company Seal"><Switch checked={s.documents.showSeal} onCheckedChange={(v) => upd('documents', { showSeal: v })} /></Row>
              <Row label="Show QR Code"><Switch checked={s.documents.showQr} onCheckedChange={(v) => upd('documents', { showQr: v })} /></Row>
              <Row label="Security Watermark"><Switch checked={s.documents.showWatermark} onCheckedChange={(v) => upd('documents', { showWatermark: v })} /></Row>
            </TabsContent>

            {/* WORKFLOW */}
            <TabsContent value="workflow" className="mt-4 space-y-1">
              <Row label="Auto-generate Quotation"><Switch checked={s.workflow.autoGenerateQuotation} onCheckedChange={(v) => upd('workflow', { autoGenerateQuotation: v })} /></Row>
              <Row label="Auto-confirm Booking"><Switch checked={s.workflow.autoConfirm} onCheckedChange={(v) => upd('workflow', { autoConfirm: v })} /></Row>
              <Row label="Auto-lock Booking"><Switch checked={s.workflow.autoLock} onCheckedChange={(v) => upd('workflow', { autoLock: v })} /></Row>
              <Row label="Require Manager Approval"><Switch checked={s.workflow.requireManagerApproval} onCheckedChange={(v) => upd('workflow', { requireManagerApproval: v })} /></Row>
              <Row label="Enable Activity Log"><Switch checked={s.workflow.enableActivityLog} onCheckedChange={(v) => upd('workflow', { enableActivityLog: v })} /></Row>
            </TabsContent>

            {/* UI */}
            <TabsContent value="ui" className="mt-4 space-y-1">
              <Row label="Show Client Category"><Switch checked={s.ui.showClientCategory} onCheckedChange={(v) => upd('ui', { showClientCategory: v })} /></Row>
              <Row label="Show GPS Coordinates"><Switch checked={s.ui.showGps} onCheckedChange={(v) => upd('ui', { showGps: v })} /></Row>
              <Row label="Show Site Contact"><Switch checked={s.ui.showSiteContact} onCheckedChange={(v) => upd('ui', { showSiteContact: v })} /></Row>
              <Row label="Show Assigned Technician"><Switch checked={s.ui.showTechnician} onCheckedChange={(v) => upd('ui', { showTechnician: v })} /></Row>
              <Row label="Show Booking Source"><Switch checked={s.ui.showBookingSource} onCheckedChange={(v) => upd('ui', { showBookingSource: v })} /></Row>
              <Row label="Default View">
                <Select value={s.ui.defaultView} onValueChange={(v: any) => upd('ui', { defaultView: v })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="form">Form</SelectItem>
                    <SelectItem value="wizard">Wizard</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Table Density">
                <Select value={s.ui.tableDensity} onValueChange={(v: any) => upd('ui', { tableDensity: v })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Accent Color">
                <Input type="color" className="w-20 h-9 p-1" value={s.ui.accentColor} onChange={(e) => upd('ui', { accentColor: e.target.value })} />
              </Row>
            </TabsContent>

            {/* PERMISSIONS */}
            <TabsContent value="permissions" className="mt-4 space-y-1">
              <p className="text-xs text-muted-foreground mb-2">Toggle which roles are allowed to perform each booking action.</p>
              {([
                ['create', 'Create Bookings'],
                ['edit', 'Edit Bookings'],
                ['delete', 'Delete Bookings'],
                ['confirm', 'Confirm Bookings'],
                ['lock', 'Lock Bookings'],
                ['applyDiscount', 'Apply Discounts'],
                ['approveDiscount', 'Approve Discounts'],
                ['generateDocs', 'Generate Documents'],
                ['printDocs', 'Print Documents'],
                ['sendWhatsapp', 'Send WhatsApp'],
              ] as const).map(([k, label]) => (
                <Row key={k} label={label}>
                  <RoleChips value={(s.permissions as any)[k]} onChange={(v) => upd('permissions', { [k]: v } as any)} />
                </Row>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/30 flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={handleReset}>Reset to Default</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Settings</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
