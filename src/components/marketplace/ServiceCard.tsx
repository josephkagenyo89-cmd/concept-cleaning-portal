import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import {
  MarketService,
  formatKes,
  serviceImage,
  startingPrice,
} from '@/lib/marketplace';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import { trackServiceClick } from '@/lib/marketplaceBehavior';
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
    <article className={`group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E9E5DC] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#D5B779] hover:shadow-[0_16px_34px_rgba(41,40,36,0.09)] ${variant === 'carousel' ? 'w-[190px] shrink-0' : ''}`}>
      <Link to={servicePath} onClick={() => trackServiceClick(service.category)} className="block overflow-hidden" aria-label={`View ${service.name}`}>
        <ServiceVisual
          image={serviceImage(service)}
          alt={service.name}
          loading={priority ? 'eager' : 'lazy'}
          className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-48"
        />
      </Link>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <span className="mb-2.5 self-start text-[9px] font-bold uppercase tracking-[0.18em] text-[#9A7A43]">
          {service.category}
        </span>

        <Link to={servicePath} onClick={() => trackServiceClick(service.category)} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D5B779]">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-[#292824] transition-colors group-hover:text-[#8B6C39] sm:text-base">{service.name}</h3>
        </Link>

        <p className="mt-2 line-clamp-2 min-h-10 text-[12px] leading-5 text-[#77736B] sm:text-[13px]">
          {service.short_description || service.description || 'Professional cleaning service tailored to your needs.'}
        </p>

        {service.estimated_duration && (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[#918B80]">
            <Clock className="h-3.5 w-3.5" /> {service.estimated_duration}
          </p>
        )}

        <div className="mt-auto border-t border-[#F0EDE6] pt-3.5">
          {pricing.original > 0 ? (
            <>
              <p className="text-base font-extrabold tracking-tight text-[#292824]">
                From {formatKes(pricing.final)}
                {pricing.active && <span className="ml-1.5 text-[10px] font-medium text-[#A6A095] line-through">{formatKes(pricing.original)}</span>}
              </p>
              {pricing.active && <p className="mt-1 text-[10px] font-bold leading-snug text-[#9A7A43]">{discount.label} · save {formatKes(pricing.discountAmount)}</p>}
            </>
          ) : (
            <p className="text-sm font-extrabold text-[#292824]">Price on quotation</p>
          )}
        </div>
      </div>
    </article>
  );
}
