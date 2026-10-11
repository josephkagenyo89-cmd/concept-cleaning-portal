import { Link } from 'react-router-dom';
import { Star, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MarketService,
  displayRating,
  formatKes,
  serviceImage,
  serviceVideo,
  startingPrice,
} from '@/lib/marketplace';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import { useGlobalDiscount } from '@/hooks/useGlobalDiscount';
import { applyGlobalDiscount } from '@/lib/globalDiscount';

interface Props {
  service: MarketService;
  variant?: 'grid' | 'carousel';
  priority?: boolean;
}

export default function ServiceCard({
  service,
  variant = 'grid',
  priority = false,
}: Props) {
  const basePrice = startingPrice(service);
  const discount = useGlobalDiscount();
  const pricing = applyGlobalDiscount(basePrice, discount);
  const price = pricing.final;
  const rating = displayRating(service.id);
  const servicePath = `/service/${service.slug || service.id}`;

  return (
    <div
      className={`group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(12,74,110,0.08)] ${
        variant === 'carousel' ? 'w-[190px] shrink-0' : ''
      }`}
    >
      <Link to={servicePath} className="block overflow-hidden">
        <ServiceVisual
          video={serviceVideo(service)}
          image={serviceImage(service)}
          alt={service.name}
          loading={priority ? 'eager' : 'lazy'}
          className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </Link>

      <div className="space-y-2.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
            {service.category}
          </span>
          {service.service_code && (
            <span className="font-mono text-[9px] font-semibold text-slate-500">
              {service.service_code}
            </span>
          )}
        </div>

        <Link to={servicePath} className="block">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">
            {service.name}
          </h3>
        </Link>

        <p className="line-clamp-2 text-[11px] leading-4 text-slate-600">
          {service.short_description || service.description || service.category}
        </p>

        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {rating.toFixed(1)}
          </span>

          {service.estimated_duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {service.estimated_duration}
            </span>
          )}
        </div>

        <div className="border-t border-slate-100 pt-2">
          {price > 0 ? (
            <>
              <p className="text-sm font-bold text-sky-900">
                From {formatKes(pricing.original)}
              </p>

              {pricing.active ? (
                <p className="mt-1 text-[10px] font-semibold text-emerald-700">
                  Book now to save {formatKes(pricing.discountAmount)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-bold text-sky-900">On quotation</p>
          )}
        </div>

        <div className="flex gap-2 pt-0.5">
          <Button asChild size="sm" className="h-8 flex-1 bg-sky-900 text-[11px] text-white hover:bg-sky-800">
            <Link to={servicePath} className="inline-flex items-center justify-center gap-1">
              Book Now <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline" className="h-8 flex-1 border-slate-200 text-[11px] text-slate-700 hover:bg-slate-50">
            <Link to={`${servicePath}?mode=quote`} className="inline-flex items-center justify-center gap-1">
              Quote
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
