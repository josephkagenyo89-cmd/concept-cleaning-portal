import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import BookingEngineQuestionsConfig from '@/components/admin/BookingEngineQuestionsConfig';

type ServiceRow = {
  id: string;
  name: string;
  service_code: string | null;
  category: string;
  base_price: number;
  is_active: boolean;
};

type ConfigRow = {
  id?: string;
  service_id: string;
  enabled: boolean;
  customer_instructions: string;
  photo_mode: 'none' | 'optional' | 'required';
  photo_min: number;
  photo_max: number;
  config_version: number;
};

export default function AdminBookingEngineConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [configs, setConfigs] = useState<Record<string, ConfigRow>>({});

  const loadData = async () => {
    setLoading(true);

    try {
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('id, name, service_code, category, base_price, is_active')
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (serviceError) throw serviceError;

      const serviceRows = (serviceData || []) as ServiceRow[];

      const { data: configData, error: configError } = await supabase
        .from('booking_engine_service_config')
        .select(
          'id, service_id, enabled, customer_instructions, photo_mode, photo_min, photo_max, config_version'
        );

      if (configError) throw configError;

      const configMap: Record<string, ConfigRow> = {};

      for (const row of configData || []) {
        configMap[row.service_id] = {
          id: row.id,
          service_id: row.service_id,
          enabled: row.enabled,
          customer_instructions: row.customer_instructions || '',
          photo_mode: row.photo_mode,
          photo_min: row.photo_min,
          photo_max: row.photo_max,
          config_version: row.config_version,
        };
      }

      setServices(serviceRows);
      setConfigs(configMap);
    } catch (error: any) {
      toast({
        title: 'Load failed',
        description: error.message || 'Unable to load Booking Engine configuration.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getConfig = (serviceId: string): ConfigRow => {
    return (
      configs[serviceId] || {
        service_id: serviceId,
        enabled: false,
        customer_instructions: '',
        photo_mode: 'none',
        photo_min: 0,
        photo_max: 0,
        config_version: 1,
      }
    );
  };

  const updateConfig = (
    serviceId: string,
    changes: Partial<ConfigRow>
  ) => {
    const current = getConfig(serviceId);

    setConfigs(prev => ({
      ...prev,
      [serviceId]: {
        ...current,
        ...changes,
      },
    }));
  };

  const saveConfig = async (service: ServiceRow) => {
    const config = getConfig(service.id);

    if (
      config.photo_min < 0 ||
      config.photo_max < 0 ||
      config.photo_min > config.photo_max
    ) {
      toast({
        title: 'Invalid photo range',
        description: 'Minimum photos cannot be greater than maximum photos.',
        variant: 'destructive',
      });
      return;
    }

    if (
      config.photo_mode === 'none' &&
      (config.photo_min !== 0 || config.photo_max !== 0)
    ) {
      toast({
        title: 'Invalid photo settings',
        description: 'Photo mode None requires both photo limits to be zero.',
        variant: 'destructive',
      });
      return;
    }

    if (
      config.photo_mode !== 'none' &&
      config.photo_max <= 0
    ) {
      toast({
        title: 'Invalid photo settings',
        description: 'Optional or Required photo mode needs a maximum greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(service.id);

    try {
      const payload = {
        service_id: service.id,
        enabled: config.enabled,
        customer_instructions: config.customer_instructions.trim() || null,
        photo_mode: config.photo_mode,
        photo_min: config.photo_min,
        photo_max: config.photo_max,
        config_version: config.config_version,
        updated_by: (await supabase.auth.getUser()).data.user?.id || null,
      };

      if (config.id) {
        const { data, error } = await supabase
          .from('booking_engine_service_config')
          .update(payload)
          .eq('id', config.id)
          .select(
            'id, service_id, enabled, customer_instructions, photo_mode, photo_min, photo_max, config_version'
          )
          .single();

        if (error) throw error;

        setConfigs(prev => ({
          ...prev,
          [service.id]: {
            ...data,
            customer_instructions: data.customer_instructions || '',
          },
        }));
      } else {
        const { data, error } = await supabase
          .from('booking_engine_service_config')
          .insert(payload)
          .select(
            'id, service_id, enabled, customer_instructions, photo_mode, photo_min, photo_max, config_version'
          )
          .single();

        if (error) throw error;

        setConfigs(prev => ({
          ...prev,
          [service.id]: {
            ...data,
            customer_instructions: data.customer_instructions || '',
          },
        }));
      }

      toast({
        title: 'Saved',
        description: `${service.name} Booking Engine configuration was saved.`,
      });
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error.message || 'Unable to save configuration.',
        variant: 'destructive',
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Booking Engine Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Configure which existing services are available through the customer Booking Engine.
        </p>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No active services found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {services.map(service => {
            const config = getConfig(service.id);
            const isSaving = saving === service.id;

            return (
              <Card key={service.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {service.category}
                        {service.service_code
                          ? ` · ${service.service_code}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {config.enabled ? (
                        <Badge>Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}

                      <Switch
                        checked={config.enabled}
                        onCheckedChange={enabled =>
                          updateConfig(service.id, { enabled })
                        }
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div>
                    <Label>Customer Instructions</Label>
                    <Textarea
                      className="mt-2"
                      value={config.customer_instructions}
                      onChange={e =>
                        updateConfig(service.id, {
                          customer_instructions: e.target.value,
                        })
                      }
                      placeholder="Instructions shown to customers for this service."
                      disabled={isSaving}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Photo Mode</Label>
                      <select
                        className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={config.photo_mode}
                        onChange={e => {
                          const photoMode = e.target.value as ConfigRow['photo_mode'];

                          updateConfig(service.id, {
                            photo_mode: photoMode,
                            ...(photoMode === 'none'
                              ? { photo_min: 0, photo_max: 0 }
                              : {}),
                          });
                        }}
                        disabled={isSaving}
                      >
                        <option value="none">None</option>
                        <option value="optional">Optional</option>
                        <option value="required">Required</option>
                      </select>
                    </div>

                    <div>
                      <Label>Minimum Photos</Label>
                      <Input
                        className="mt-2"
                        type="number"
                        min={0}
                        value={config.photo_min}
                        onChange={e =>
                          updateConfig(service.id, {
                            photo_min: Number(e.target.value),
                          })
                        }
                        disabled={isSaving || config.photo_mode === 'none'}
                      />
                    </div>

                    <div>
                      <Label>Maximum Photos</Label>
                      <Input
                        className="mt-2"
                        type="number"
                        min={0}
                        value={config.photo_max}
                        onChange={e =>
                          updateConfig(service.id, {
                            photo_max: Number(e.target.value),
                          })
                        }
                        disabled={isSaving || config.photo_mode === 'none'}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        document
                          .getElementById("booking-engine-customer-questions")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                    >
                      Customer Questions
                    </Button>

                    <Button
                      onClick={() => saveConfig(service)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Save Configuration
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <BookingEngineQuestionsConfig />
    </div>
  );
}
