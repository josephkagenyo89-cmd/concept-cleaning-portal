import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowRight, ClipboardList } from 'lucide-react';

interface BookingEngineService {
  id: string;
  configId: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category: string;
  base_price: number;
  pricing_model: string;
  pricing_unit: string;
  image_url: string | null;
  estimated_duration: string | null;
  customer_instructions: string | null;
}

export default function BookingEngine() {
  const { isCustomer } = useAuth();
  const [services, setServices] = useState<BookingEngineService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadServices = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: configs, error: configError } = await supabase
          .from('booking_engine_service_config')
          .select(
            'id, service_id, customer_instructions, photo_mode, photo_min, photo_max, measurement_config, availability_config, config_version'
          )
          .eq('enabled', true);

        if (configError) throw configError;

        const serviceIds = (configs || []).map((config) => config.service_id);

        if (serviceIds.length === 0) {
          setServices([]);
          return;
        }

        const { data: serviceRows, error: serviceError } = await supabase
          .from('services')
          .select(
            'id, name, short_description, description, category, base_price, pricing_model, pricing_unit, image_url, estimated_duration, is_active'
          )
          .in('id', serviceIds)
          .eq('is_active', true)
          .order('category')
          .order('name');

        if (serviceError) throw serviceError;

        const configByServiceId = new Map(
          (configs || []).map((config) => [config.service_id, config])
        );

        const mapped = (serviceRows || []).map((service) => {
          const config = configByServiceId.get(service.id);

          return {
            id: service.id,
            configId: config?.id || '',
            name: service.name,
            short_description: service.short_description,
            description: service.description,
            category: service.category,
            base_price: Number(service.base_price) || 0,
            pricing_model: service.pricing_model,
            pricing_unit: service.pricing_unit,
            image_url: service.image_url,
            estimated_duration: service.estimated_duration,
            customer_instructions: config?.customer_instructions || null,
          };
        });

        setServices(mapped);
      } catch (err) {
        console.error('Failed to load Booking Engine services:', err);
        setError('Unable to load Booking Engine services.');
      } finally {
        setLoading(false);
      }
    };

    if (isCustomer) {
      loadServices();
    } else {
      setLoading(false);
    }
  }, [isCustomer]);

  if (!isCustomer) {
    return null;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <ClipboardList className="h-5 w-5" />
            <span className="text-sm font-medium">Booking Engine</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Request a Cleaning Service
          </h1>

          <p className="mt-2 max-w-2xl text-muted-foreground">
            Tell us what you need. We&apos;ll review your request and guide you
            through the next steps.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : services.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="font-semibold">No services are available yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Please check again later or browse our regular services.
              </p>
              <Button asChild className="mt-4">
                <Link to="/categories">Browse Services</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card key={service.id} className="overflow-hidden">
                {service.image_url ? (
                  <img
                    src={service.image_url}
                    alt={service.name}
                    className="h-44 w-full object-cover"
                  />
                ) : null}

                <CardContent className="p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {service.category}
                  </p>

                  <h2 className="mt-1 text-lg font-semibold">{service.name}</h2>

                  {service.short_description || service.description ? (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {service.short_description || service.description}
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Starting from
                      </p>
                      <p className="font-semibold">
                        KSh {service.base_price.toLocaleString()}
                      </p>
                    </div>

                    <Button disabled>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
