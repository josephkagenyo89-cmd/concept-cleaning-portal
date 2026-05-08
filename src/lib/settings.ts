import { supabase } from '@/integrations/supabase/client';

export type SettingsCategory =
  | 'general'
  | 'document'
  | 'tax'
  | 'payment'
  | 'commission'
  | 'crm'
  | 'system'
  | 'notifications'
  | 'integrations';

export interface GeneralSettings {
  company_name: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  logo_url: string;
}

export interface DocumentSettings {
  primary_color: string;
  footer_text: string;
  terms_conditions: string;
}

export interface TaxSettings { vat_enabled: boolean; vat_percentage: number; }

export interface PaymentSettings {
  mpesa_paybill: string;
  mpesa_till: string;
  mpesa_account: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string;
}

export interface CommissionSettings { type: 'tiered' | 'fixed' | 'percentage'; fixed_amount: number; percentage: number; }
export interface CrmSettings { vip_threshold: number; inactive_days: number; followup_days: number; }
export interface SystemSettings { currency: string; date_format: string; auto_numbering: boolean; }
export interface NotificationSettings {
  whatsapp_signature_template: string;
  whatsapp_invoice_template: string;
  whatsapp_quotation_template: string;
}

export interface IntegrationsSettings {
  google_review_url: string;
}

export interface AllSettings {
  general: GeneralSettings;
  document: DocumentSettings;
  tax: TaxSettings;
  payment: PaymentSettings;
  commission: CommissionSettings;
  crm: CrmSettings;
  system: SystemSettings;
  notifications: NotificationSettings;
  integrations: IntegrationsSettings;
}

export const DEFAULT_SETTINGS: AllSettings = {
  general: {
    company_name: 'Concept Cleaning Services',
    phone: '+254796563741',
    email: 'info@conceptcleaning.co.ke',
    address: 'Nairobi, Kenya',
    website: 'https://conceptcleaning.co.ke',
    logo_url: '',
  },
  document: {
    primary_color: '#2A9D8F',
    footer_text: 'Thank you for choosing Concept Cleaning Services.',
    terms_conditions: '1. Payment due on receipt unless agreed otherwise.\n2. All services are guaranteed for 7 days.\n3. Cancellations require 24-hour notice.',
  },
  tax: { vat_enabled: false, vat_percentage: 16 },
  payment: { mpesa_paybill: '', mpesa_till: '', mpesa_account: '', bank_name: '', bank_account_name: '', bank_account_number: '', bank_branch: '' },
  commission: { type: 'tiered', fixed_amount: 0, percentage: 10 },
  crm: { vip_threshold: 50000, inactive_days: 30, followup_days: 14 },
  system: { currency: 'Ksh', date_format: 'DD/MM/YYYY', auto_numbering: true },
  notifications: {
    whatsapp_signature_template: 'Hello {client_name}, thank you for choosing Concept Cleaning Services. Your service is complete. Please confirm and sign here: {link}',
    whatsapp_invoice_template: 'Hello {client_name}, please find your invoice {invoice_number} for Ksh {amount}.',
    whatsapp_quotation_template: 'Hello {client_name}, here is your quotation {quotation_number} for Ksh {amount}.',
  },
};

let cache: AllSettings | null = null;
let cachePromise: Promise<AllSettings> | null = null;

export async function loadAllSettings(force = false): Promise<AllSettings> {
  if (!force && cache) return cache;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    const { data, error } = await supabase.from('system_settings' as any).select('category, value');
    const result: AllSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (!error && data) {
      for (const row of data as any[]) {
        if (row.category in result) {
          (result as any)[row.category] = { ...(result as any)[row.category], ...(row.value || {}) };
        }
      }
    }
    cache = result;
    cachePromise = null;
    return result;
  })();

  return cachePromise;
}

export async function saveSettings<C extends SettingsCategory>(category: C, value: AllSettings[C]) {
  const { error } = await supabase
    .from('system_settings' as any)
    .upsert({ category, value: value as any }, { onConflict: 'category' });
  if (error) throw error;
  cache = null; // invalidate
}

export function clearSettingsCache() { cache = null; }
