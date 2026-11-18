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


import { getBookingOfferReadinessIssues } from './bookingEngineOffers';

const readyPackageInput = {
  offer_type: 'package',
  starts_at: '2026-11-01T00:00:00.000Z',
  ends_at: '2026-12-01T00:00:00.000Z',
  links: [
    { service_id: 'sofa', relationship: 'trigger' as const },
    { service_id: 'mattress', relationship: 'included' as const },
    { service_id: 'carpet', relationship: 'recommended' as const },
  ],
  services: [
    { id: 'sofa', name: 'Sofa Cleaning', is_active: true },
    { id: 'mattress', name: 'Mattress Cleaning', is_active: true },
    { id: 'carpet', name: 'Carpet Cleaning', is_active: false },
  ],
  configurations: [
    { service_id: 'sofa', enabled: true, has_active_pricing: true },
    { service_id: 'mattress', enabled: true, has_active_pricing: true },
  ],
};

describe('Smart Booking offer readiness', () => {
  it('allows packages with active, enabled and priced trigger/included services', () => {
    expect(getBookingOfferReadinessIssues(readyPackageInput)).toEqual([]);
  });

  it('does not block an offer because an optional recommendation is inactive', () => {
    expect(getBookingOfferReadinessIssues(readyPackageInput)).toEqual([]);
  });

  it('blocks publication when an included service is inactive', () => {
    const input = {
      ...readyPackageInput,
      services: readyPackageInput.services.map((service) =>
        service.id === 'mattress' ? { ...service, is_active: false } : service,
      ),
    };
    expect(getBookingOfferReadinessIssues(input)).toContain('Mattress Cleaning is inactive in the service catalogue.');
  });

  it('blocks publication when a required service is not enabled in Smart Booking', () => {
    const input = {
      ...readyPackageInput,
      configurations: readyPackageInput.configurations.map((config) =>
        config.service_id === 'mattress' ? { ...config, enabled: false } : config,
      ),
    };
    expect(getBookingOfferReadinessIssues(input)).toContain('Mattress Cleaning is not enabled in Smart Booking.');
  });

  it('blocks publication when a required service has no active pricing rule', () => {
    const input = {
      ...readyPackageInput,
      configurations: readyPackageInput.configurations.map((config) =>
        config.service_id === 'mattress' ? { ...config, has_active_pricing: false } : config,
      ),
    };
    expect(getBookingOfferReadinessIssues(input)).toContain('Mattress Cleaning has no active Smart Booking pricing rule.');
  });

  it('requires at least one included service for packages', () => {
    const links = readyPackageInput.links.filter((link) => link.relationship !== 'included');
    expect(getBookingOfferReadinessIssues({ ...readyPackageInput, links }))
      .toContain('A package needs at least one complimentary service.');
  });

  it('rejects an end date that is not later than the start date', () => {
    expect(getBookingOfferReadinessIssues({ ...readyPackageInput, ends_at: '2026-10-01T00:00:00.000Z' }))
      .toContain('The campaign end date must be later than its start date.');
  });
});
