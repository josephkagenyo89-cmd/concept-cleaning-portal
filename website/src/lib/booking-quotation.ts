import { formatKES } from "@/lib/pricing";

export interface BookingQuoteLine {
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface BookingFreeAddon {
  name: string;
  description?: string | null;
  regularPrice?: number | null;
}

export interface BookingQuotationData {
  bookingNumber: string;
  clientName: string;
  phone: string;
  location: string;
  date: string;
  timeSlot: string;
  paymentMethod: string;
  notes?: string | null;
  serviceLines: BookingQuoteLine[];
  freeAddons: BookingFreeAddon[];
  pricing: {
    subtotal: number;
    membershipDiscount: number;
    promoDiscount: number;
    bundleDiscount: number;
    transport: number;
    total: number;
  };
}

export const getBookingSavings = (quotation: BookingQuotationData) => {
  const discount = quotation.pricing.membershipDiscount
    + quotation.pricing.promoDiscount
    + quotation.pricing.bundleDiscount;
  const freeAddonValue = quotation.freeAddons.reduce(
    (sum, addon) => sum + Math.max(0, Number(addon.regularPrice) || 0),
    0,
  );

  return {
    discount,
    freeAddonValue,
    total: discount + freeAddonValue,
    originalTotal: quotation.pricing.subtotal + quotation.pricing.transport + freeAddonValue,
  };
};

const cleanDescription = (description?: string | null) =>
  description?.replace(/\s+/g, " ").trim();

export const buildBookingWhatsAppMessage = (quotation: BookingQuotationData) => {
  const savings = getBookingSavings(quotation);
  const [primary, ...addedServices] = quotation.serviceLines;
  const serviceLine = (line: BookingQuoteLine) => {
    const description = cleanDescription(line.description);
    return [
      `• ${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ""}`,
      description ? `  ${description}` : null,
      `  ${formatKES(line.unitPrice)} each · ${formatKES(line.unitPrice * line.quantity)}`,
    ].filter(Boolean).join("\n");
  };

  const discountLines = [
    quotation.pricing.membershipDiscount > 0
      ? `• Membership discount: −${formatKES(quotation.pricing.membershipDiscount)}` : null,
    quotation.pricing.bundleDiscount > 0
      ? `• Bundle discount: −${formatKES(quotation.pricing.bundleDiscount)}` : null,
    quotation.pricing.promoDiscount > 0
      ? `• Promotion discount: −${formatKES(quotation.pricing.promoDiscount)}` : null,
  ].filter(Boolean);

  const addons = quotation.freeAddons.length
    ? quotation.freeAddons.map((addon) => {
      const description = cleanDescription(addon.description);
      const originalPrice = Number(addon.regularPrice) || 0;
      const value = originalPrice > 0 ? `~${formatKES(originalPrice)}~ → ` : "";
      return `• ${addon.name}${description ? ` — ${description}` : ""}: ${value}FREE (${formatKES(0)})`;
    }).join("\n")
    : "No complimentary add-ons were applied to this booking.";

  return [
    "✨ *CONCEPT CLEANING SERVICES — BOOKING SUMMARY* ✨",
    `Booking reference: *${quotation.bookingNumber}*`,
    "",
    "👤 *CLIENT & APPOINTMENT*",
    `Name: ${quotation.clientName}`,
    `Phone: ${quotation.phone}`,
    `Location: ${quotation.location}`,
    `Date & time: ${quotation.date} · ${quotation.timeSlot}`,
    `Payment: ${quotation.paymentMethod}`,
    "",
    "🧹 *SERVICE BOOKED*",
    primary ? serviceLine(primary) : "No service details available.",
    ...(addedServices.length ? ["", "➕ *ADDED SERVICES*", ...addedServices.map(serviceLine)] : []),
    "",
    "🎁 *FREE ADD-ONS*",
    addons,
    "",
    "💰 *PRICE & SAVINGS*",
    `Service subtotal: ${formatKES(quotation.pricing.subtotal)}`,
    `Transport: ${formatKES(quotation.pricing.transport)}`,
    ...discountLines,
    `Original value: ~${formatKES(savings.originalTotal)}~`,
    `*YOU SAVE: ${formatKES(savings.total)}*`,
    `*TOTAL TO PAY: ${formatKES(quotation.pricing.total)}*`,
    quotation.notes ? `\nSpecial instructions: ${quotation.notes}` : "",
    "",
    "Please confirm my booking and service details.",
  ].filter(Boolean).join("\n");
};