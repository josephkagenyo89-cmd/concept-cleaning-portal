import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ServiceCard from '@/components/marketplace/ServiceCard';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import {
  CATEGORY_ORDER,
  categoryImage,
  fetchMarketCategories,
  fetchMarketServicesByCategory,
  MarketService,
} from '@/lib/marketplace';
import { trackCategoryClick, trackCategoryView } from '@/lib/marketplaceBehavior';

export default function MarketCategories() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [params] = useSearchParams();
  const active = params.get('c')?.trim() || '';

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(false);
    setServices([]);

    const request = active
      ? fetchMarketServicesByCategory(active)
      : fetchMarketCategories();

    request
      .then((items) => {
        if (!mounted) return;

        if (active) {
          setServices(items as MarketService[]);
        } else {
          const rows = items as string[];
          const order = (category: string) => {
            const index = CATEGORY_ORDER.indexOf(category);
            return index < 0 ? 99 : index;
          };
          setCategories(
            [...rows].sort(
              (a, b) => order(a) - order(b) || a.localeCompare(b)
            )
          );
        }
      })
      .catch(() => {
        if (mounted) setLoadError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [active]);

  useEffect(() => {
    if (active) trackCategoryView(active);
  }, [active]);

  return (
    <main className="min-h-screen bg-[#FAF9F6] pb-12 text-[#292824]">
      <div className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-11">
        <header className="mb-7 border-b border-[#E9E5DC] pb-6 md:mb-9 md:pb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9A7A43] sm:text-xs">
            The service collection
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-[#292824] sm:text-3xl md:text-4xl">
            {active || 'Browse categories'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#77736B]">
            {active
              ? `Explore the active services listed under ${active}. Open a service to see its full description, features, pricing details and booking options.`
              : 'Choose a service category to explore its available services, descriptions and pricing details.'}
          </p>
        </header>

        <nav
          aria-label="Filter by service category"
          className="mb-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[#E9E5DC] pb-4"
        >
          <Link
            to="/categories"
            className={`text-xs font-bold transition-colors sm:text-sm ${
              !active
                ? 'text-[#292824]'
                : 'text-[#918B80] hover:text-[#292824]'
            }`}
          >
            All categories
          </Link>

          {categories.map((category) => (
            <Link
              key={category}
              to={`/categories?c=${encodeURIComponent(category)}`}
              onClick={() => trackCategoryClick(category)}
              aria-current={active === category ? 'page' : undefined}
              className={`text-xs font-semibold transition-colors sm:text-sm ${
                active === category
                  ? 'text-[#9A7A43] underline decoration-[#D5B779] decoration-2 underline-offset-8'
                  : 'text-[#918B80] hover:text-[#292824]'
              }`}
            >
              {category}
            </Link>
          ))}
        </nav>

        {loading ? (
          <p className="rounded-2xl border border-[#E9E5DC] bg-white p-6 text-sm text-[#77736B]">
            Loading {active ? 'category services' : 'categories'}…
          </p>
        ) : loadError ? (
          <div className="rounded-2xl border border-[#E9E5DC] bg-white p-6 text-sm text-[#77736B]">
            We could not load the catalogue. Please refresh and try again.
          </div>
        ) : active ? (
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-[#292824] md:text-xl">
                Available services
              </h2>
              <span className="text-xs text-[#918B80]">
                {services.length} {services.length === 1 ? 'service' : 'services'}
              </span>
            </div>

            {services.length ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {services.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#DCD5C8] bg-white p-8 text-center">
                <p className="font-bold text-[#292824]">
                  No active services are currently listed in this category.
                </p>
                <Link
                  to="/categories"
                  className="mt-3 inline-block text-sm font-semibold text-[#9A7A43] hover:text-[#292824]"
                >
                  Explore all categories
                </Link>
              </div>
            )}
          </section>
        ) : (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category}
                to={`/categories?c=${encodeURIComponent(category)}`}
                onClick={() => trackCategoryClick(category)}
                className="group overflow-hidden rounded-2xl border border-[#E9E5DC] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#D5B779] hover:shadow-[0_16px_34px_rgba(41,40,36,0.09)]"
              >
                <div className="overflow-hidden">
                  <ServiceVisual
                    image={categoryImage(category)}
                    alt={category}
                    className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-48"
                  />
                </div>
                <div className="p-3.5 sm:p-4">
                  <span className="block text-sm font-bold leading-snug text-[#292824]">
                    {category}
                  </span>
                  <span className="mt-1.5 block text-[11px] text-[#918B80]">
                    Explore services
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
