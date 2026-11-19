import { describe, expect, it } from 'vitest';
import { buildGuestBookingDetails, buildGuestRequestNotes, normalizeGuestPhone, pickVisibleGuestAnswers, buildVisibleGuestMeasurements, createGuestSubmissionFingerprint } from './bookingEngineGuestRequest';
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
describe('guest booking details snapshot', () => {
  it('sends IDs and answers but never client-calculated prices', () => {
    const snapshot = buildGuestBookingDetails({
      quantity: 5, quantityUnit: 'seats', measurements: { rooms: 2 },
      answers: { fabric: 'Cotton' }, selectedExtras: ['scope-id', 'offer:offer-id'],
      selectedOfferId: '11111111-1111-4111-8111-111111111111', selectedOfferVersions: { '11111111-1111-4111-8111-111111111111': '2026-11-19T10:00:00.000Z', '22222222-2222-4222-8222-222222222222': '2026-11-19T10:01:00.000Z' }, serviceConfigVersion: 4,
    });
    expect(snapshot).toEqual({
      quantity: 5, quantity_unit: 'seats', measurements: { rooms: 2 },
      answers: { fabric: 'Cotton' }, selected_extras: ['scope-id', 'offer:offer-id'],
      selected_offer_id: '11111111-1111-4111-8111-111111111111', selected_offer_versions: { '11111111-1111-4111-8111-111111111111': '2026-11-19T10:00:00.000Z', '22222222-2222-4222-8222-222222222222': '2026-11-19T10:01:00.000Z' }, service_config_version: 4,
    });
    expect(snapshot).not.toHaveProperty('price');
    expect(snapshot).not.toHaveProperty('total');
  });
  it('deduplicates selected extras and strips malformed object inputs', () => {
    const snapshot = buildGuestBookingDetails({
      quantity: null, quantityUnit: 'units', measurements: [] as any, answers: null as any,
      selectedExtras: ['x', 'x'], selectedOfferId: '', selectedOfferVersions: {}, serviceConfigVersion: 1,
    });
    expect(snapshot.measurements).toEqual({});
    expect(snapshot.answers).toEqual({});
    expect(snapshot.selected_extras).toEqual(['x']);
    expect(snapshot.selected_offer_id).toBeNull();
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
      scopeExtras: ['Move furniture'], notes: 'Call before arrival', photosRequired: true,
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

describe('visible guided booking answers', () => {
  const questions = [
    { id: 'q1', question_key: 'rooms', input_type: 'measurement' },
    { id: 'q2', question_key: 'fabric', input_type: 'select' },
    { id: 'q3', question_key: 'hidden_area', input_type: 'measurement' },
  ];
  const answers = { rooms: '3', fabric: 'Cotton', hidden_area: '99' };
  const visibility = { q1: { visible: true }, q2: { visible: true }, q3: { visible: false } };

  it('excludes hidden answers from the guest snapshot', () => {
    expect(pickVisibleGuestAnswers(questions, answers, visibility)).toEqual({
      rooms: '3',
      fabric: 'Cotton',
    });
  });

  it('only sends visible positive measurement answers to pricing', () => {
    expect(buildVisibleGuestMeasurements(questions, answers, visibility)).toEqual({ rooms: 3 });
  });
});

describe('guest submission retry fingerprint', () => {
  it('is stable for the same payload and changes when the request changes', async () => {
    const first = await createGuestSubmissionFingerprint({ service: 'sofa', date: '2026-12-01' });
    const repeated = await createGuestSubmissionFingerprint({ service: 'sofa', date: '2026-12-01' });
    const changed = await createGuestSubmissionFingerprint({ service: 'sofa', date: '2026-12-02' });
    expect(first).toBe(repeated);
    expect(first).not.toBe(changed);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});
