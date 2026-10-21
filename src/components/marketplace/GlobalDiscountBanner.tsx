import { useGlobalDiscount } from '@/hooks/useGlobalDiscount';

/** Days left until the discount ends (Nairobi end of day), or null if it has ended or has no end date. */
function daysLeft(endDate: string): number | null {
  if (!endDate) return null;
  const end = new Date(`${endDate}T23:59:59+03:00`);
  if (Number.isNaN(end.getTime())) return null;
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  return days > 0 ? days : null;
}

/** Promotion banner. Renders nothing unless the admin global discount is active. */
export default function GlobalDiscountBanner() {
  const discount = useGlobalDiscount();
  if (!discount.active) return null;

  const left = daysLeft(discount.endDate);

  return (
    <div role="status" className="bg-[#C6A66B] px-4 py-2.5 text-center text-sm font-semibold text-[#333333]">
      <span>{discount.label}</span>
      <span className="ml-2 font-normal">· {discount.percentage}% off all services</span>
      {left !== null && (
        <span className="ml-2 inline-block rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
          Ends in {left} {left === 1 ? 'day' : 'days'}
        </span>
      )}
    </div>
  );
}
