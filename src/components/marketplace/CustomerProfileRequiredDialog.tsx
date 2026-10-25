import { useState } from 'react';
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
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const cleanPhone = phone.trim();

    if (cleanPhone.replace(/\D/g, '').length < 9) {
      toast({
        title: 'Enter your phone number',
        description: 'Please enter a valid phone number, for example 0712345678.',
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

    if (!claimedId) {
      // 2. No matching record: create one. Name comes from the Google account.
      const metadata = (user.user_metadata || {}) as Record<string, string>;
      const fullName = metadata.full_name || metadata.name || user.email || 'Customer';

      const { error: insertError } = await supabase
        .from('clients')
        .insert({
          full_name: fullName,
          phone: cleanPhone,
          whatsapp_number: cleanPhone,
          email: user.email ?? null,
          notes: null,
          status: 'new',
          created_by: user.id,
          created_by_role: 'customer',
          user_id: user.id,
        } as any);

      if (insertError) {
        setSaving(false);
        // Unique phone constraint: the number belongs to an existing record.
        // Never link it here. An admin links it after a WhatsApp check.
        const phoneTaken = (insertError as { code?: string }).code === '23505';
        toast({
          title: phoneTaken ? 'Phone number already registered' : 'Could not save your phone number',
          description: phoneTaken
            ? PHONE_ON_FILE_MESSAGE
            : 'Please try again, or contact us on WhatsApp.',
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(false);
    await refreshProfile();

    toast({
      title: 'Account ready',
      description: 'You can now book and track your services.',
    });
  };

  // A client record exists only with a phone number, so the popup is needed only
  // until a record with a phone is linked or created.
  const needsPhone = !!user && isCustomer && (!customerClient || !customerClient.phone?.trim());

  if (!needsPhone) return null;

  return (
    <Dialog open={true}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add your phone number</DialogTitle>
          <DialogDescription>
            Enter your phone number to finish setting up your account. We use it
            to confirm your bookings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
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
