import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface BookingEngineService {
  id: string;
  name: string;
  category: string;
}

export default function BookingEnginePrompt() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<BookingEngineService[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let started = false;

    const startBrowsingTimer = () => {
      if (started) return;
      started = true;

      timer = setTimeout(() => {
        setOpen(true);
      }, 20000);
    };

    window.addEventListener('scroll', startBrowsingTimer, { passive: true });

    return () => {
      window.removeEventListener('scroll', startBrowsingTimer);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const loadServices = async () => {
      setLoading(true);

      try {
        const { data: configs, error: configError } = await supabase
          .from('booking_engine_service_config')
          .select('service_id')
          .eq('enabled', true);

        if (configError) throw configError;

        const serviceIds = (configs || []).map(config => config.service_id);

        if (serviceIds.length === 0) {
          setServices([]);
          return;
        }

        const { data, error } = await supabase
          .from('services')
          .select('id, name, category')
          .in('id', serviceIds)
          .eq('is_active', true)
          .order('category')
          .order('name');

        if (error) throw error;

        setServices((data || []) as BookingEngineService[]);
      } catch (error) {
        console.error('Failed to load Booking Engine prompt services:', error);
        setServices([]);
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, []);

  const filteredServices = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return services;

    return services.filter(
      service =>
        service.name.toLowerCase().includes(value) ||
        service.category.toLowerCase().includes(value)
    );
  }, [query, services]);

  const selectService = (serviceId: string) => {
    setOpen(false);
    navigate(`/booking-engine?service=${encodeURIComponent(serviceId)}`);
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);

    if (!value) {
      setQuery('');
    }
  };

  if (services.length === 0 && !loading) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>What service are you looking for?</DialogTitle>
          <DialogDescription>
            Choose a service and we’ll guide you through the details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search services..."
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {loading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Loading services...
              </p>
            ) : filteredServices.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No matching services found.
              </p>
            ) : (
              filteredServices.map(service => (
                <Button
                  key={service.id}
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start py-3 text-left"
                  onClick={() => selectService(service.id)}
                >
                  <span>
                    <span className="block font-medium">{service.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {service.category}
                    </span>
                  </span>
                </Button>
              ))
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setOpen(false)}
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
