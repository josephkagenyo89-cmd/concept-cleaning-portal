export type GuestBookingQuestion = { label: string; value: unknown };
export type GuestBookingPackage = {
  title: string;
  price: unknown;
  items: Array<{
    label: string;
    size: string;
    quantity: number | string;
    complimentary: boolean;
    individualPrice: number | string | null;
  }>;
};
export type GuestBookingAddon = { title: string; priceMode: string; priceValue: number | string | null };
export type GuestBookingNotesInput = {
  serviceName: string;
  quantity?: { value: number | string; unit: string } | null;
  questions?: GuestBookingQuestion[];
  packageOffer?: GuestBookingPackage | null;
  addons?: GuestBookingAddon[];
  scopeExtras?: string[];
  notes?: string;
  photosRequired?: boolean;
};
const money = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? 'price to confirm'
    : Number.isFinite(Number(value))
      ? 'KES ' + Number(value).toLocaleString('en-KE')
      : 'price to confirm';
export function normalizeGuestPhone(value: string): string {
  const clean = String(value || '').trim().replace(/[()\s-]/g, '');
  if (/^0[17]\d{8}$/.test(clean)) return '+254' + clean.slice(1);
  if (/^254[17]\d{8}$/.test(clean)) return '+' + clean;
  return /^\+[1-9]\d{7,14}$/.test(clean) ? clean : '';
}
export function buildGuestRequestNotes(input: GuestBookingNotesInput): string {
  const lines = ['[GUIDED BOOKING DETAILS]', 'Primary service: ' + input.serviceName];
  if (input.quantity) lines.push('Quantity: ' + input.quantity.value + ' ' + input.quantity.unit);
  if (input.questions?.length) {
    lines.push('Service answers:');
    for (const question of input.questions) {
      const value = Array.isArray(question.value) ? question.value.join(', ')
        : typeof question.value === 'boolean' ? (question.value ? 'Yes' : 'No')
        : String(question.value ?? '');
      lines.push('- ' + question.label + ': ' + value);
    }
  }
  if (input.packageOffer) {
    lines.push('Selected package: ' + input.packageOffer.title + ' · advertised package price ' + money(input.packageOffer.price));
    lines.push('Package contents (staff to verify):');
    for (const item of input.packageOffer.items) {
      const value = item.complimentary ? 'COMPLIMENTARY' : money(item.individualPrice) + ' × ' + item.quantity + ' (included in package price)';
      lines.push('- ' + item.label + ' · ' + item.size + ' · Qty ' + item.quantity + ' · ' + value);
    }
  }
  if (input.addons?.length) {
    lines.push('Selected add-ons/upgrades (staff to verify):');
    for (const addon of input.addons) {
      const value = addon.priceMode === 'fixed' ? money(addon.priceValue)
        : addon.priceMode === 'fixed_discount' ? money(addon.priceValue) + ' discount'
        : addon.priceMode === 'percentage_discount' ? String(addon.priceValue) + '% discount'
        : 'price to confirm';
      lines.push('- ' + addon.title + ' · ' + value);
    }
  }
  if (input.scopeExtras?.length) lines.push('Additional scope requested: ' + input.scopeExtras.join(', '));
  if (input.photosRequired) lines.push('Service photos: required; staff to request/collect from guest.');
  if (input.notes?.trim()) lines.push('Customer notes: ' + input.notes.trim());
  const result = lines.join('\n');
  if (result.length > 1000) throw new Error('The captured service details exceed the guest request limit. Shorten optional notes or remove some selections.');
  return result;
}