export interface DeliveryZone {
  id: string;
  zone_name: string;
  areas: string[];
  fee: number;
}

const FREE_DELIVERY_THRESHOLD = 2000;

export const getDeliveryFee = (
  productTotal: number,
  location: string,
  zones: DeliveryZone[]
): { fee: number; zone: string | null; freeDelivery: boolean } => {
  if (productTotal >= FREE_DELIVERY_THRESHOLD) {
    return { fee: 0, zone: null, freeDelivery: true };
  }

  const locationLower = location.toLowerCase().trim();
  for (const z of zones) {
    if (z.areas.some((a) => locationLower.includes(a.toLowerCase()))) {
      return { fee: z.fee, zone: z.zone_name, freeDelivery: false };
    }
  }

  // Default fee for unknown zones
  return { fee: 400, zone: "Other", freeDelivery: false };
};

export const getFreeDeliveryRemaining = (productTotal: number) =>
  Math.max(0, FREE_DELIVERY_THRESHOLD - productTotal);

export const FREE_DELIVERY_THRESHOLD_VALUE = FREE_DELIVERY_THRESHOLD;

export const generateOrderNumber = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rand}`;
};

export const deliveryStatusMessages: Record<string, string> = {
  Pending: "Hello, your order has been received and is being processed.",
  Confirmed: "Your order has been confirmed and will be prepared for delivery.",
  "Out for Delivery": "Your order is on the way 🚚",
  Delivered: "Your order has been delivered successfully. Thank you for choosing us!",
};
