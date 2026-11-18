import { describe, expect, it } from 'vitest';
import {
  bookingOfferSelectionKey,
  groupBookingOffers,
  isBookingOfferCurrent,
  toggleBookingOfferSelection,
} from './bookingEngineOffers';

describe('Smart Booking offer availability', () => {
  const now = Date.parse('2026-11-18T10:00:00.000Z');

  it('includes an offer at its start instant and before its end instant', () => {
    expect(isBookingOfferCurrent({ starts_at: '2026-11-18T10:00:00.000Z', ends_at: '2026-11-18T10:01:00.000Z' }, now)).toBe(true);
  });

  it('excludes offers that have not started or have reached their end instant', () => {
    expect(isBookingOfferCurrent({ starts_at: '2026-11-18T10:00:01.000Z', ends_at: null }, now)).toBe(false);
    expect(isBookingOfferCurrent({ starts_at: null, ends_at: '2026-11-18T10:00:00.000Z' }, now)).toBe(false);
  });

  it('excludes malformed date windows rather than publishing them accidentally', () => {
    expect(isBookingOfferCurrent({ starts_at: 'not-a-date', ends_at: null }, now)).toBe(false);
    expect(isBookingOfferCurrent({ starts_at: null, ends_at: 'not-a-date' }, now)).toBe(false);
  });
});

describe('Smart Booking offer grouping', () => {
  it('separates packages from selectable add-ons and upgrades', () => {
    const groups = groupBookingOffers([
      { id: 'p1', offer_type: 'package' },
      { id: 'a1', offer_type: 'add_on' },
      { id: 'u1', offer_type: 'upgrade' },
      { id: 'r1', offer_type: 'recurring' },
    ]);
    expect(groups.packages.map((offer) => offer.id)).toEqual(['p1']);
    expect(groups.addons.map((offer) => offer.id)).toEqual(['a1', 'u1']);
  });
});

describe('Smart Booking add-on selection persistence', () => {
  it('uses a namespaced key so existing service-scope extra IDs remain intact', () => {
    expect(bookingOfferSelectionKey('offer-123')).toBe('offer:offer-123');
    expect(toggleBookingOfferSelection(['scope-extra-1'], 'offer-123', true))
      .toEqual(['scope-extra-1', 'offer:offer-123']);
  });

  it('does not duplicate an add-on and removes only the selected offer key', () => {
    expect(toggleBookingOfferSelection(['scope-extra-1', 'offer:offer-123'], 'offer-123', true))
      .toEqual(['scope-extra-1', 'offer:offer-123']);
    expect(toggleBookingOfferSelection(['scope-extra-1', 'offer:offer-123'], 'offer-123', false))
      .toEqual(['scope-extra-1']);
  });
});
