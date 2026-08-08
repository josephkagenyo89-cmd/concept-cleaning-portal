import { Link } from 'react-router-dom';
import { Star, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketService, displayRating, formatKes, serviceImage, startingPrice } from '@/lib/marketplace';
import { useGlobalDiscount } from '@/hooks/useGlobalDiscount';
import { applyGlobalDiscount } from '@/lib/globalDiscount';

interface Props {
  service: MarketService;
  variant?: 'grid' | 'carousel';
}

export default function ServiceCard({ service, variant = 'grid' }: Props) {
  const basePrice = startingPrice(service);
  const discount = useGlobalDiscount();
  const pricing = applyGlobalDiscount(basePrice, discount);
  const price = pricing.final;
  const rating = displayRating(service.id);


  return (
    <div
      className={`overflow-hidden rounded-xl border bg-card shadow-sm ${
        variant === 'carousel' ? 'w-[190px] shrink-0' : ''
      }`}
    >
      <Link to={`/service/${service.id}`}>
        <img
          src={serviceImage(service)}
          alt={service.name}
          loading="lazy"
          width={800}
          height={600}
          className="h-28 w-full object-cover"
        />
      </Link>
      <div className="space-y-1.5 p-3">
        <Link to={`/service/${service.id}`} className="block">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{service.name}</h3>
        </Link>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {service.short_description || service.description || service.category}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-0.5 font-medium text-foreground">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {rating.toFixed(1)}
          </span>
          {service.estimated_duration && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" /> {service.estimated_duration}
            </span>
          )}
        </div>
        <div className="pt-0.5">
          {price > 0 ? (
            <>
              <p className="text-sm font-bold text-market">
                From {formatKes(price)}
                <span className="text-[10px] font-medium text-muted-foreground"> /{service.pricing_unit}</span>
              </p>
              {pricing.active && (
                <p className="text-[11px] text-muted-foreground">
                  <span className="line-through">{formatKes(pricing.original)}</span>{' '}
                  <span className="font-semibold text-destructive">-{pricing.percentage}%</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm font-bold text-market">On quotation</p>
          )}
        </div>

        <div className="flex gap-1.5 pt-1">
          <Button asChild size="sm" className="h-8 flex-1 bg-market text-market-foreground hover:bg-market/90">
            <Link to={`/service/${service.id}`}>Book Now</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-8 flex-1 text-xs">
            <Link to={`/service/${service.id}?mode=quote`}>Quotation</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
