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
export type GuestBookingDetailsInput = {
  quantity: number | null;
  quantityUnit: string;
  measurements: Record<string, unknown>;
  answers: Record<string, unknown>;
  selectedExtras: string[];
  selectedOfferId: string | null;
  selectedOfferVersions: Record<string, string>;
  serviceConfigVersion: number;
};
export type GuestBookingDetailsSnapshot = {
  quantity: number | null;
  quantity_unit: string;
  measurements: Record<string, unknown>;
  answers: Record<string, unknown>;
  selected_extras: string[];
  selected_offer_id: string | null;
  selected_offer_versions: Record<string, string>;
  service_config_version: number;
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
/** Send catalogue IDs and customer answers only. Prices are always resolved again by trusted server code. */
export function buildGuestBookingDetails(input: GuestBookingDetailsInput): GuestBookingDetailsSnapshot {
  return {
    quantity: input.quantity,
    quantity_unit: String(input.quantityUnit || 'units').trim().slice(0, 30),
    measurements: input.measurements && typeof input.measurements === 'object' && !Array.isArray(input.measurements) ? input.measurements : {},
    answers: input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers) ? input.answers : {},
    selected_extras: Array.from(new Set((input.selectedExtras || []).filter((value) => typeof value === 'string'))),
    selected_offer_id: input.selectedOfferId || null,
    selected_offer_versions: Object.fromEntries(Object.entries(input.selectedOfferVersions || {}).filter(([id, updatedAt]) => !!id && typeof updatedAt === 'string')),
    service_config_version: input.serviceConfigVersion,
  };
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

export type VisibleBookingQuestion = { id: string; question_key: string; input_type: string };
export type QuestionVisibility = Record<string, { visible?: boolean }>;

export function pickVisibleGuestAnswers(
  questions: VisibleBookingQuestion[],
  answers: Record<string, unknown>,
  visibility: QuestionVisibility,
): Record<string, unknown> {
  return Object.fromEntries(
    questions
      .filter((question) => visibility[question.id]?.visible === true
        && Object.prototype.hasOwnProperty.call(answers, question.question_key)
        && answers[question.question_key] !== undefined)
      .map((question) => [question.question_key, answers[question.question_key]]),
  );
}

export function buildVisibleGuestMeasurements(
  questions: VisibleBookingQuestion[],
  answers: Record<string, unknown>,
  visibility: QuestionVisibility,
): Record<string, number> {
  const measurements: Record<string, number> = {};
  for (const question of questions) {
    if (question.input_type !== 'measurement' || visibility[question.id]?.visible !== true) continue;
    const value = Number(answers[question.question_key]);
    if (answers[question.question_key] !== '' && Number.isFinite(value) && value > 0) {
      measurements[question.question_key] = value;
    }
  }
  return measurements;
}

export async function createGuestSubmissionFingerprint(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}
