import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ServiceCard from '@/components/marketplace/ServiceCard';
import ServiceVisual from '@/components/marketplace/ServiceVisual';
import { categoryImage, MarketService } from '@/lib/marketplace';
import { fetchServiceCategories, type ServiceCategory } from '@/lib/serviceCategories';
import { supabase } from '@/integrations/supabase/client';
import { trackCategoryClick, trackCategoryView } from '@/lib/marketplaceBehavior';

export default function MarketCategories() {
  const [services, setServices] = useState<MarketService[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [params] = useSearchParams();
  const active = params.get('c')?.trim() || '';

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(false);
    setServices([]);

    const load = async () => {
      const { data: categoryRows, error: categoryError } = await fetchServiceCategories(true);
      if (categoryError) throw categoryError;

      const availableCategories = categoryRows || [];
      if (!mounted) return;

      setCategories(availableCategories);

      if (active) {
        const selectedCategory = availableCategories.find((category) => category.id === active);
        if (!selectedCategory) {
          setServices([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('services')
          .select('id, name, slug, service_code, description, short_description, base_price, price_per_sqm, pricing_model, pricing_unit, is_active, image_url, estimated_duration, service_features')
          .eq('is_active', true)
          .eq('category_id', selectedCategory.id)
          .order('name', { ascending: true });

        if (error) throw error;
        if (!mounted) return;

        setServices((data || []).map((service: any) => ({
          ...service,
          category: selectedCategory.name,
          slug: service.slug || null,
          base_price: Number(service.base_price) || 0,
          price_per_sqm: Number(service.price_per_sqm) || 0,
          service_features: Array.isArray(service.service_features) ? service.service_features : [],
        })) as MarketService[]);
      }
    };

    load()
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

  const activeCategory = categories.find((category) => category.id === active);

  useEffect(() => {
    if (activeCategory) trackCategoryView(activeCategory.name);
  }, [activeCategory]);

  return (
    <main className="min-h-screen bg-[#FAF9F6] pb-12 text-[#292824]">
      <div className="mx-auto max-w-7xl px-4 py-7 md:px-8 md:py-11">
        <header className="mb-7 border-b border-[#E9E5DC] pb-6 md:mb-9 md:pb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9A7A43] sm:text-xs">
            The service collection
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-[#292824] sm:text-3xl md:text-4xl">
            {activeCategory?.name || 'Browse categories'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#77736B]">
            {active
              ? `Explore the active services listed under ${activeCategory?.name || 'this category'}. Open a service to see its full description, features, pricing details and booking options.`
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
              key={category.id}
              to={`/categories?c=${encodeURIComponent(category.id)}`}
              onClick={() => trackCategoryClick(category.name)}
              aria-current={active === category.id ? 'page' : undefined}
              className={`text-xs font-semibold transition-colors sm:text-sm ${
                active === category.id
                  ? 'text-[#9A7A43] underline decoration-[#D5B779] decoration-2 underline-offset-8'
                  : 'text-[#918B80] hover:text-[#292824]'
              }`}
            >
              {category.name}
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
                key={category.id}
                to={`/categories?c=${encodeURIComponent(category.id)}`}
                onClick={() => trackCategoryClick(category.name)}
                className="group overflow-hidden rounded-2xl border border-[#E9E5DC] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#D5B779] hover:shadow-[0_16px_34px_rgba(41,40,36,0.09)]"
              >
                <div className="overflow-hidden">
                  <ServiceVisual
                    image={categoryImage(category.name, category.image_key)}
                    alt={category.name}
                    className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-48"
                  />
                </div>
                <div className="p-3.5 sm:p-4">
                  <span className="block text-sm font-bold leading-snug text-[#292824]">
                    {category.name}
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
