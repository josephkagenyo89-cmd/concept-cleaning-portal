import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { useGlobalDiscount } from '@/hooks/useGlobalDiscount';
import { CATEGORY_ORDER, categoryImage } from '@/lib/marketplace';
import { getRecommendedCategory } from '@/lib/marketplaceBehavior';

const DISMISSAL_PREFIX = 'concept-global-discount-dismissed-v1:';

function daysLeft(endDate: string): number | null {
  if (!endDate) return null;

  const end = new Date(`${endDate}T23:59:59+03:00`);
  if (Number.isNaN(end.getTime())) return null;

  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  return days > 0 ? days : null;
}

export default function GlobalDiscountBanner() {
  const discount = useGlobalDiscount();
  const navigate = useNavigate();

  const [visible, setVisible] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  const dismissalKey = `${DISMISSAL_PREFIX}${discount.label}:${discount.percentage}:${discount.endDate}`;

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(dismissalKey, '1');
    } catch {
      // The promotion can still be dismissed if session storage is unavailable.
    }

    setVisible(false);
  }, [dismissalKey]);

  useEffect(() => {
    setVisible(false);
    setCategory(null);

    if (!discount.active) return;

    try {
      if (sessionStorage.getItem(dismissalKey) === '1') return;
    } catch {
      // Continue without persistence if session storage is unavailable.
    }

    const timer = window.setTimeout(() => {
      setCategory(getRecommendedCategory(CATEGORY_ORDER));
      setVisible(true);
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [discount.active, dismissalKey]);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, dismiss]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;

    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (distance > 100) dismiss();
  };

  if (!discount.active || !visible || !category) return null;

  const left = daysLeft(discount.endDate);
  const image = categoryImage(category);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Concept Cleaning Services special offer"
      className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#171714]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: `url("${image}")` }}
        aria-hidden="true"
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-black/85" />

      <button
        type="button"
        onClick={dismiss}
        aria-label="Close promotion"
        className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-black/30 text-white backdrop-blur-md transition hover:bg-white/20 sm:right-8 sm:top-8"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-16 text-center text-white sm:px-10">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#D5B779]/70 bg-black/25 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#F0D9A5] backdrop-blur-sm sm:text-xs">
          <Sparkles className="h-4 w-4" />
          Exclusive online offer
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/75 sm:text-sm">
          Concept Cleaning Services
        </p>

        <h2 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          {discount.label || 'A Special Offer'}
        </h2>

        <div className="my-7 flex flex-col items-center">
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-[#F0D9A5]">
            Enjoy
          </span>
          <span className="my-1 text-7xl font-black leading-none tracking-tighter text-[#F0D9A5] sm:text-9xl">
            {discount.percentage}%
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.25em] text-white sm:text-base">
            Off all services
          </span>
        </div>

        <p className="max-w-xl text-sm leading-7 text-white/85 sm:text-base">
          Experience exceptional cleaning and professional pest control.
          Book online and enjoy this limited-time offer.
        </p>

        {left !== null && (
          <p className="mt-5 rounded-full border border-white/35 bg-black/25 px-4 py-2 text-xs font-semibold tracking-wide text-white backdrop-blur-sm">
            Offer ends in {left} {left === 1 ? 'day' : 'days'}
          </p>
        )}

        <button
          type="button"
          onClick={() => {
            dismiss();
            navigate(`/categories?c=${encodeURIComponent(category)}`);
          }}
          className="mt-9 inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#D5B779] px-8 py-4 text-sm font-extrabold uppercase tracking-[0.12em] text-[#292824] shadow-xl transition hover:bg-[#F0D9A5] sm:px-10"
        >
          Explore the offer
          <ArrowRight className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 px-5 py-2 text-xs font-semibold tracking-wide text-white/75 underline decoration-white/40 underline-offset-4 transition hover:text-white"
        >
          Maybe later
        </button>

        <p className="mt-8 text-[9px] font-medium uppercase tracking-[0.25em] text-white/50">
          Swipe right or close to continue browsing
        </p>
      </div>
    </div>
  );
}
