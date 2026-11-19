import { describe, expect, it } from 'vitest';
import { buildGuestRequestNotes, normalizeGuestPhone } from './bookingEngineGuestRequest';
describe('guest booking contact normalization', () => {
  it('normalizes common Kenyan mobile formats', () => {
    expect(normalizeGuestPhone('0712 345 678')).toBe('+254712345678');
    expect(normalizeGuestPhone('254712345678')).toBe('+254712345678');
    expect(normalizeGuestPhone('+254 712-345-678')).toBe('+254712345678');
  });
  it('rejects incomplete or malformed numbers', () => {
    expect(normalizeGuestPhone('071234')).toBe('');
    expect(normalizeGuestPhone('hello')).toBe('');
  });
});
describe('guest booking request notes', () => {
  it('captures package contents, answers, add-ons and additional scope', () => {
    const notes = buildGuestRequestNotes({
      serviceName: 'Sofa Cleaning',
      quantity: { value: 5, unit: 'seats' },
      questions: [{ label: 'Fabric type', value: 'Cotton' }, { label: 'Pets?', value: false }],
      packageOffer: { title: 'Gold Package', price: 10000, items: [
        { label: 'Sofa Cleaning', size: '5 seats', quantity: 1, complimentary: false, individualPrice: 7000 },
        { label: 'Mattress Cleaning', size: '6x6', quantity: 1, complimentary: true, individualPrice: 0 },
      ] },
      addons: [{ title: 'Carpet Protection', priceMode: 'fixed', priceValue: 1500 }],
      scopeExtras: ['Move furniture'],
      notes: 'Call before arrival',
      photosRequired: true,
    });
    expect(notes).toContain('Selected package: Gold Package');
    expect(notes).toContain('Mattress Cleaning · 6x6 · Qty 1 · COMPLIMENTARY');
    expect(notes).toContain('Fabric type: Cotton');
    expect(notes).toContain('Pets?: No');
    expect(notes).toContain('Carpet Protection');
    expect(notes).toContain('Service photos: required');
    expect(notes.length).toBeLessThanOrEqual(1000);
  });
  it('rejects details that would be silently truncated by the guest intake endpoint', () => {
    expect(() => buildGuestRequestNotes({ serviceName: 'Sofa Cleaning', notes: 'x'.repeat(1100) }))
      .toThrow(/exceed the guest request limit/);
  });
});