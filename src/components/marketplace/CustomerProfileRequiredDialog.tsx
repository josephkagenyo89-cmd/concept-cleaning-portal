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

const PHONE_ON_FILE_MESSAGE =
  'This phone number is already on our records. Contact us on WhatsApp and we will link your account.';

export default function CustomerProfileRequiredDialog() {
  const { user, isCustomer, customerClient, refreshProfile } = useAuth();
  const metadata = (user?.user_metadata || {}) as Record<string, string>;
  // Name comes from the Google account and is not editable.
  const googleName =
    metadata.full_name || metadata.name || (user?.email ? user.email.split('@')[0] : 'Customer');

  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhone(customerClient?.phone || '');
    setLocation(customerClient?.location || '');
  }, [customerClient]);

  const save = async () => {
    const cleanPhone = phone.trim();
    const cleanLocation = location.trim();

    if (cleanPhone.replace(/\D/g, '').length < 9) {
      toast({
        title: 'Enter your phone number',
        description: 'Please enter a valid phone number, for example 0712345678.',
        variant: 'destructive',
      });
      return;
    }

    if (!cleanLocation) {
      toast({
        title: 'Enter your location',
        description: 'Please enter your estate, area or town.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    setSaving(true);

    // 1. Verified email link (server-side). The phone number is never used to link.
    const { data: claimedId, error: claimError } = await supabase.rpc('claim_client_record' as any);

    if (claimError) {
      setSaving(false);
      toast({
        title: 'Could not complete your account',
        description: 'Please try again, or contact us on WhatsApp.',
        variant: 'destructive',
      });
      return;
    }

    if (claimedId) {
      // Matched by verified email: fill in what's missing, keep the phone already on file.
      const { error: updateError } = await supabase
        .from('clients')
        .update({ location: cleanLocation, updated_at: new Date().toISOString() } as any)
        .eq('id', claimedId as any);

      setSaving(false);

      if (updateError) {
        toast({
          title: 'Could not save your location',
          description: 'Please try again, or contact us on WhatsApp.',
          variant: 'destructive',
        });
        return;
      }
    } else {
      // 2. No match: create the customer record from the Google account and the entered details.
      const { error: insertError } = await supabase
        .from('clients')
        .insert({
          full_name: googleName,
          phone: cleanPhone,
          whatsapp_number: cleanPhone,
          location: cleanLocation,
          email: user.email ?? null,
          notes: null,
          status: 'new',
          created_by: user.id,
          created_by_role: 'customer',
          user_id: user.id,
        } as any);

      setSaving(false);

      if (insertError) {
        // Unique phone constraint: the number belongs to an existing record.
        // Never link it here. An admin links it after a WhatsApp check.
        const phoneTaken = (insertError as { code?: string }).code === '23505';
        toast({
          title: phoneTaken ? 'Phone number already registered' : 'Could not save your details',
          description: phoneTaken
            ? PHONE_ON_FILE_MESSAGE
            : 'Please try again, or contact us on WhatsApp.',
          variant: 'destructive',
        });
        return;
      }
    }

    await refreshProfile();

    toast({
      title: 'Account ready',
      description: 'You can now book and track your services.',
    });
  };

  // Shown only to signed-in customers whose record is missing a phone number or location.
  const needsDetails =
    !!user &&
    isCustomer &&
    (!customerClient || !customerClient.phone?.trim() || !customerClient.location?.trim());

  if (!needsDetails) return null;

  return (
    <Dialog open={true}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Complete your account</DialogTitle>
          <DialogDescription>
            Add your phone number and location to finish setting up your account.
            We use them to confirm your bookings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="required-name">Full name (from your Google account)</Label>
            <Input id="required-name" value={googleName} readOnly disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="required-phone">Phone number</Label>
            <Input
              id="required-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0712345678"
              type="tel"
              inputMode="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="required-location">Location</Label>
            <Input
              id="required-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Estate, area or town"
            />
          </div>

          <Button type="button" className="w-full" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Continue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
