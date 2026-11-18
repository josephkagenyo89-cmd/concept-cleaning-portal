export type BookingOfferWindow = {
  id: string;
  offer_type: string;
  starts_at?: string | null;
  ends_at?: string | null;
};

export type BookingOfferGroups<T extends BookingOfferWindow> = {
  packages: T[];
  addons: T[];
};

export function isBookingOfferCurrent(
  offer: Pick<BookingOfferWindow, 'starts_at' | 'ends_at'>,
  now = Date.now(),
): boolean {
  if (offer.starts_at) {
    const starts = new Date(offer.starts_at).getTime();
    if (!Number.isFinite(starts) || starts > now) return false;
  }
  if (offer.ends_at) {
    const ends = new Date(offer.ends_at).getTime();
    if (!Number.isFinite(ends) || ends <= now) return false;
  }
  return true;
}

export function groupBookingOffers<T extends BookingOfferWindow>(offers: T[]): BookingOfferGroups<T> {
  return {
    packages: offers.filter((offer) => offer.offer_type === 'package'),
    addons: offers.filter((offer) => offer.offer_type === 'add_on' || offer.offer_type === 'upgrade'),
  };
}

export const bookingOfferSelectionKey = (offerId: string) => 'offer:' + offerId;

export function toggleBookingOfferSelection(selected: string[], offerId: string, checked: boolean): string[] {
  const key = bookingOfferSelectionKey(offerId);
  return checked
    ? Array.from(new Set([...selected, key]))
    : selected.filter((value) => value !== key);
}


export type BookingOfferReadinessLink = {
  service_id: string;
  relationship: 'trigger' | 'included' | 'recommended';
};

export type BookingOfferReadinessInput = {
  offer_type: string;
  starts_at?: string | null;
  ends_at?: string | null;
  links: BookingOfferReadinessLink[];
  services: Array<{ id: string; name?: string | null; is_active: boolean }>;
  configurations: Array<{ service_id: string; enabled: boolean; has_active_pricing: boolean }>;
  now?: number;
};

/**
 * Returns actionable reasons an offer cannot safely be published.
 * Trigger and included services must be active, Booking Engine-enabled,
 * and backed by at least one active pricing rule. Recommended services are
 * optional and do not block publication.
 */
export function getBookingOfferReadinessIssues(input: BookingOfferReadinessInput): string[] {
  const issues: string[] = [];
  const triggerIds = Array.from(new Set(input.links.filter((link) => link.relationship === 'trigger').map((link) => link.service_id)));
  const includedIds = Array.from(new Set(input.links.filter((link) => link.relationship === 'included').map((link) => link.service_id)));

  if (triggerIds.length === 0) issues.push('Choose at least one starting service.');
  if (input.offer_type === 'package' && includedIds.length === 0) issues.push('A package needs at least one included service.');

  const overlap = triggerIds.filter((id) => includedIds.includes(id));
  if (overlap.length) issues.push('A starting service cannot also be an included service.');

  const requiredIds = Array.from(new Set([...triggerIds, ...includedIds]));
  for (const id of requiredIds) {
    const service = input.services.find((item) => item.id === id);
    if (!service) {
      issues.push('A selected service could not be found in the service catalogue.');
      continue;
    }
    const label = service.name?.trim() || 'Selected service';
    if (!service.is_active) {
      issues.push(label + ' is inactive in the service catalogue.');
      continue;
    }
    const serviceConfigs = input.configurations.filter((item) => item.service_id === id);
    if (!serviceConfigs.some((item) => item.enabled)) {
      issues.push(label + ' is not enabled in Smart Booking.');
      continue;
    }
    if (!serviceConfigs.some((item) => item.enabled && item.has_active_pricing)) {
      issues.push(label + ' has no active Smart Booking pricing rule.');
    }
  }

  const start = input.starts_at ? new Date(input.starts_at).getTime() : null;
  const end = input.ends_at ? new Date(input.ends_at).getTime() : null;
  if (start !== null && !Number.isFinite(start)) issues.push('The campaign start date is invalid.');
  if (end !== null && !Number.isFinite(end)) issues.push('The campaign end date is invalid.');
  if (start !== null && end !== null && Number.isFinite(start) && Number.isFinite(end) && end <= start) {
    issues.push('The campaign end date must be later than its start date.');
  }

  return Array.from(new Set(issues));
}
