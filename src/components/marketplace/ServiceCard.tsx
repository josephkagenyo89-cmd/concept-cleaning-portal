import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MarketService,
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

export default function ServiceCard({ service, variant = 'grid', priority = false }: Props) {
  const discount = useGlobalDiscount();
  const pricing = applyGlobalDiscount(startingPrice(service), discount);
  const servicePath = `/service/${service.slug || service.id}`;

  return (
    <article className={`group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-[#E4DFD2] bg-white shadow-[0_3px_14px_rgba(51,51,51,0.035)] transition duration-200 hover:-translate-y-1 hover:border-[#C6A66B] hover:shadow-[0_14px_30px_rgba(51,51,51,0.09)] ${variant === 'carousel' ? 'w-[190px] shrink-0' : ''}`}>
      <Link to={servicePath} className="block overflow-hidden" aria-label={`View ${service.name}`}>
        <ServiceVisual
          image={serviceImage(service)}
          alt={service.name}
          loading={priority ? 'eager' : 'lazy'}
          className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] sm:h-48"
        />
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <span className="mb-2.5 self-start rounded-full border border-[#E7D7B5] bg-[#FBF6E9] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#806025]">
          {service.category}
        </span>

        <Link to={servicePath} className="block">
          <h3 className="line-clamp-2 text-sm font-extrabold leading-snug text-[#333333] sm:text-base">{service.name}</h3>
        </Link>

        <p className="mt-2 line-clamp-2 min-h-10 text-[13px] leading-5 text-[#6A6257]">
          {service.short_description || service.description || 'Professional cleaning service tailored to your needs.'}
        </p>

        {service.estimated_duration && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#5A5752]">
            <Clock className="h-3.5 w-3.5" /> {service.estimated_duration}
          </p>
        )}

        <div className="mt-auto border-t border-[#EEE7DA] pt-3.5">
          {pricing.original > 0 ? (
            <>
              <p className="text-base font-extrabold tracking-tight text-[#333333]">
                From {formatKes(pricing.final)}
                {pricing.active && <span className="ml-1.5 text-[10px] font-medium text-[#5A5752] line-through">{formatKes(pricing.original)}</span>}
              </p>
              {pricing.active && <p className="mt-1 text-[10px] font-bold leading-snug text-[#8A6A2B]">{discount.label} · save {formatKes(pricing.discountAmount)}</p>}
            </>
          ) : (
            <p className="text-sm font-extrabold text-[#333333]">Price on quotation</p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
          <Button asChild size="sm" className="h-9 rounded-full bg-[#333333] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#45413B]">
            <Link to={servicePath}>View service <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-9 rounded-full border-[#D8C8A2] px-3 text-xs font-bold text-[#333333] hover:bg-[#FBF6E9]">
            <Link to={`${servicePath}?mode=quote`}>Quote</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
