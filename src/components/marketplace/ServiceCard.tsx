import { Link } from 'react-router-dom';
import { Star, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MarketService,
  displayRating,
  formatKes,
  serviceImage,
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
      className={`group overflow-hidden rounded-2xl border border-brand-sand bg-white transition-shadow duration-200 hover:shadow-md dark:bg-card ${
        variant === 'carousel' ? 'w-[190px] shrink-0' : ''
      }`}
    >
      <Link to={servicePath} className="block overflow-hidden">
        <ServiceVisual
          image={serviceImage(service)}
          alt={service.name}
          loading={priority ? 'eager' : 'lazy'}
          className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </Link>

      <div className="space-y-2.5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-brand-paper dark:bg-muted px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-brand-brassDark">
            {service.category}
          </span>
          {service.service_code && (
            <span className="font-mono text-[9px] font-semibold text-brand-slate dark:text-muted-foreground">
              {service.service_code}
            </span>
          )}
        </div>

        <Link to={servicePath} className="block">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-brand-ink dark:text-card-foreground">
            {service.name}
          </h3>
        </Link>

        <p className="line-clamp-2 text-[11px] leading-4 text-brand-slate dark:text-muted-foreground">
          {service.short_description || service.description || service.category}
        </p>

        <div className="flex items-center justify-between gap-2 text-[10px] text-brand-slate dark:text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-brand-ink dark:text-card-foreground">
            <Star className="h-3 w-3 fill-brand-brass text-brand-brass" />
            {rating.toFixed(1)}
          </span>

          {service.estimated_duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {service.estimated_duration}
            </span>
          )}
        </div>

        <div className="border-t border-brand-sand pt-2">
          {price > 0 ? (
            <>
              <p className="text-sm font-bold text-brand-forest">
                From {formatKes(pricing.final)}
                {pricing.active ? (
                  <span className="ml-2 text-[10px] font-medium text-brand-slate dark:text-muted-foreground/60 line-through">
                    {formatKes(pricing.original)}
                  </span>
                ) : null}
              </p>

              {pricing.active ? (
                <p className="mt-1 text-[10px] font-semibold text-brand-brassDark">
                  {discount.label} ({pricing.percentage}%) — save {formatKes(pricing.discountAmount)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm font-bold text-brand-forest">On quotation</p>
          )}
        </div>

        <div className="flex gap-2 pt-0.5">
          <Button asChild size="sm" className="h-8 flex-1 bg-brand-forest text-[11px] text-brand-cream hover:bg-brand-panel">
            <Link to={servicePath} className="inline-flex items-center justify-center gap-1">
              Book Now <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>

          <Button asChild size="sm" variant="outline" className="h-8 flex-1 border-brand-sand text-[11px] text-brand-forest hover:bg-brand-paper dark:hover:bg-muted">
            <Link to={`${servicePath}?mode=quote`} className="inline-flex items-center justify-center gap-1">
              Quote
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
