/**
 * Customer (marketplace) authentication helpers.
 *
 * Customers register with the same fields as the CRM client form — no email is
 * collected. The phone number is the credential handle, so a deterministic
 * synthetic email address is derived from it for the auth account.
 */

const CUSTOMER_EMAIL_DOMAIN = 'customer.conceptcleaning.app';

/** Digits only, Kenyan numbers normalised to 254XXXXXXXXX. */
export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

/** Human/CRM display form: 07XXXXXXXX where possible. */
export function localPhone(raw: string): string {
  const n = normalizePhone(raw);
  if (n.startsWith('254') && n.length === 12) return `0${n.slice(3)}`;
  return n;
}

export function isValidPhone(raw: string): boolean {
  const n = normalizePhone(raw);
  return n.length >= 10 && n.length <= 15;
}

/** Deterministic synthetic auth email derived from the phone number. */
export function phoneToAuthEmail(raw: string): string {
  return `c${normalizePhone(raw)}@${CUSTOMER_EMAIL_DOMAIN}`;
}

export function friendlyAuthError(message: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('duplicate')) {
    return 'An account already exists for this phone number. Please sign in instead.';
  }
  if (m.includes('invalid login credentials')) {
    return 'Phone number or password is incorrect.';
  }
  if (m.includes('password')) return message;
  return message || 'Something went wrong. Please try again.';
}
