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
