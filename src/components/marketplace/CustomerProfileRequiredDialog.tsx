import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

export default function CustomerProfileRequiredDialog() {
  const { user, customerClient, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customerClient) {
      setForm({
        full_name: customerClient.full_name || '',
        phone: customerClient.phone || '',
        location: customerClient.location || '',
      });
      return;
    }

    if (user) {
      const metadata = (user.user_metadata || {}) as Record<string, string>;

      setForm({
        full_name: metadata.full_name || metadata.name || '',
        phone: metadata.phone || '',
        location: metadata.location || '',
      });
    }
  }, [customerClient, user]);

  const save = async () => {
    const fullName = form.full_name.trim();
    const phone = form.phone.trim();
    const location = form.location.trim();

    if (!fullName || !phone || !location) {
      toast({
        title: 'Complete your profile',
        description: 'Full name, phone number and location are required.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    setSaving(true);

    const { data: existingClient, error: lookupError } = await supabase
      .from('clients')
      .select('id, user_id')
      .eq('phone', phone)
      .maybeSingle();

    if (lookupError) {
      setSaving(false);
      toast({
        title: 'Could not check phone number',
        description: lookupError.message,
        variant: 'destructive',
      });
      return;
    }

    if (
      existingClient &&
      existingClient.user_id &&
      existingClient.user_id !== user.id
    ) {
      setSaving(false);
      toast({
        title: 'Phone number already registered',
        description: 'Please use the phone number linked to your customer account.',
        variant: 'destructive',
      });
      return;
    }

    const { error: saveError } = existingClient
      ? await supabase
          .from('clients')
          .update({
            user_id: user.id,
            full_name: fullName,
            whatsapp_number: phone,
            location,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existingClient.id)
      : await supabase
          .from('clients')
          .insert({
            full_name: fullName,
            phone,
            whatsapp_number: phone,
            location,
            notes: null,
            status: 'new',
            created_by: user.id,
            created_by_role: 'customer',
            user_id: user.id,
          } as any);

    setSaving(false);

    if (saveError) {
      toast({
        title: 'Could not create profile',
        description: saveError.message,
        variant: 'destructive',
      });
      return;
    }

    await refreshProfile();

    toast({
      title: 'Profile completed',
      description: 'Your customer profile is now ready.',
    });
  };

  const profileIncomplete =
    !customerClient ||
    !customerClient.full_name?.trim() ||
    !customerClient.phone?.trim() ||
    !customerClient.location?.trim();

  if (!user || !profileIncomplete) return null;

  return (
    <Dialog open={true}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Complete your customer profile</DialogTitle>
          <DialogDescription>
            Please provide your details before continuing. Your phone number
            will be used to create or link your customer record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="required-full-name">Full name</Label>
            <Input
              id="required-full-name"
              value={form.full_name}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  full_name: e.target.value,
                }))
              }
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="required-phone">Phone number</Label>
            <Input
              id="required-phone"
              value={form.phone}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  phone: e.target.value,
                }))
              }
              placeholder="e.g. 0712345678"
              type="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="required-location">Location</Label>
            <Input
              id="required-location"
              value={form.location}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  location: e.target.value,
                }))
              }
              placeholder="Estate / area / town"
            />
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}