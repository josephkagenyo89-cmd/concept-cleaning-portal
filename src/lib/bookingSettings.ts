/**
 * Booking Module–only settings.
 * Persisted in localStorage so it never affects CRM, Quotations, Invoices,
 * Receipts, Certificates, Pest, Reports, or any other module.
 */

export interface BookingModuleSettings {
  general: {
    bookingPrefix: string;
    bookingNumberFormat: string; // e.g. "{PREFIX}-{YYYY}-{SEQ}"
    defaultStatus: 'draft' | 'pending' | 'confirmed';
    defaultDate: 'today' | 'tomorrow' | 'none';
    currency: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
  };
  client: {
    requireClientId: boolean;
    searchById: boolean;
    searchByPhone: boolean;
    autoFetchFromCrm: boolean;
    allowWalkIn: boolean;
    preventDuplicatePhone: boolean;
  };
  service: {
    enableMultiple: boolean;
    defaultQuantity: number;
    defaultUnit: string;
    enableVat: boolean;
    defaultVatRate: number;
    enableDiscounts: boolean;
    defaultDiscountType: 'percent' | 'fixed';
  };
  discount: {
    requireApproval: boolean;
    maxPercent: number;
    maxAmount: number;
    mandatoryReason: boolean;
    allowSalespersonDiscounts: boolean;
    adminApprovalRequired: boolean;
    superAdminOverride: boolean;
  };
  payment: {
    defaultTerms: string;
    allowDeposits: boolean;
    requireDeposit: boolean;
    enableBalanceTracking: boolean;
  };
  documents: {
    autoQuotation: boolean;
    autoInvoice: boolean;
    autoReceipt: boolean;
    autoCertificate: boolean;
    pdfTemplate: 'classic' | 'modern' | 'compact';
    showLogo: boolean;
    showSeal: boolean;
    showQr: boolean;
    showWatermark: boolean;
  };
  workflow: {
    autoGenerateQuotation: boolean;
    autoConfirm: boolean;
    autoLock: boolean;
    requireManagerApproval: boolean;
    enableActivityLog: boolean;
  };
  ui: {
    showClientCategory: boolean;
    showGps: boolean;
    showSiteContact: boolean;
    showTechnician: boolean;
    showBookingSource: boolean;
    defaultView: 'form' | 'wizard';
    tableDensity: 'compact' | 'comfortable';
    accentColor: string;
  };
  permissions: {
    create: string[];
    edit: string[];
    delete: string[];
    confirm: string[];
    lock: string[];
    applyDiscount: string[];
    approveDiscount: string[];
    generateDocs: string[];
    printDocs: string[];
    sendWhatsapp: string[];
  };
}

export const DEFAULT_BOOKING_SETTINGS: BookingModuleSettings = {
  general: {
    bookingPrefix: 'BK',
    bookingNumberFormat: '{PREFIX}-{YYYY}-{SEQ}',
    defaultStatus: 'draft',
    defaultDate: 'today',
    currency: 'KES',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
  },
  client: {
    requireClientId: false,
    searchById: true,
    searchByPhone: true,
    autoFetchFromCrm: true,
    allowWalkIn: true,
    preventDuplicatePhone: true,
  },
  service: {
    enableMultiple: true,
    defaultQuantity: 1,
    defaultUnit: 'Service',
    enableVat: false,
    defaultVatRate: 16,
    enableDiscounts: true,
    defaultDiscountType: 'percent',
  },
  discount: {
    requireApproval: true,
    maxPercent: 30,
    maxAmount: 10000,
    mandatoryReason: true,
    allowSalespersonDiscounts: true,
    adminApprovalRequired: true,
    superAdminOverride: true,
  },
  payment: {
    defaultTerms: 'Cash on completion',
    allowDeposits: true,
    requireDeposit: false,
    enableBalanceTracking: true,
  },
  documents: {
    autoQuotation: true,
    autoInvoice: true,
    autoReceipt: false,
    autoCertificate: false,
    pdfTemplate: 'modern',
    showLogo: true,
    showSeal: true,
    showQr: true,
    showWatermark: true,
  },
  workflow: {
    autoGenerateQuotation: true,
    autoConfirm: false,
    autoLock: false,
    requireManagerApproval: false,
    enableActivityLog: true,
  },
  ui: {
    showClientCategory: true,
    showGps: true,
    showSiteContact: true,
    showTechnician: true,
    showBookingSource: true,
    defaultView: 'form',
    tableDensity: 'comfortable',
    accentColor: '#0A66C2',
  },
  permissions: {
    create: ['agent', 'admin', 'super_admin'],
    edit: ['admin', 'super_admin'],
    delete: ['super_admin'],
    confirm: ['admin', 'super_admin'],
    lock: ['admin', 'super_admin'],
    applyDiscount: ['agent', 'admin', 'super_admin'],
    approveDiscount: ['admin', 'super_admin'],
    generateDocs: ['admin', 'super_admin'],
    printDocs: ['agent', 'admin', 'super_admin'],
    sendWhatsapp: ['agent', 'admin', 'super_admin'],
  },
};

const KEY = 'ccs.bookingModuleSettings.v1';

export function loadBookingSettings(): BookingModuleSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_BOOKING_SETTINGS;
    const parsed = JSON.parse(raw);
    // shallow-merge each section against defaults so new keys pick up defaults
    const merged: any = {};
    for (const k of Object.keys(DEFAULT_BOOKING_SETTINGS) as Array<keyof BookingModuleSettings>) {
      merged[k] = { ...(DEFAULT_BOOKING_SETTINGS as any)[k], ...((parsed || {})[k] || {}) };
    }
    return merged as BookingModuleSettings;
  } catch {
    return DEFAULT_BOOKING_SETTINGS;
  }
}

export function saveBookingSettings(s: BookingModuleSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetBookingSettings() {
  localStorage.removeItem(KEY);
}
