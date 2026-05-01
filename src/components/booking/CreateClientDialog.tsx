import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';
import type { SelectedClient } from './ClientSearchSelector';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillPhone?: string;
  onCreated: (client: SelectedClient) => void;
  /** When true, after create navigate admins to full CRM profile instead of returning. */
  navigateToProfileOnCreate?: boolean;
};

export default function CreateClientDialog({ open, onOpenChange, prefillPhone, onCreated, navigateToProfileOnCreate }: Props) {
  const { user, profile, isAdmin, isAgent } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', phone: prefillPhone || '', location: '' });
  const [saving, setSaving] = useState(false);

  // Sync prefill phone when dialog opens
  useState(() => {
    if (prefillPhone) setForm(f => ({ ...f, phone: prefillPhone }));
  });

  const handleSave = async () => {
    if (!user) return;
    const phone = form.phone.trim();
    const name = form.full_name.trim();
    if (!name || !phone) {
      toast({ title: 'Missing fields', description: 'Name and phone are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Check duplicate
    const { data: existing } = await supabase
      .from('clients')
      .select('id, client_code, full_name, phone, location')
      .eq('phone', phone)
      .maybeSingle();
    if (existing) {
      setSaving(false);
      toast({
        title: 'Client already exists',
        description: 'Please search instead. This phone number is already in the CRM.',
        variant: 'destructive',
      });
      return;
    }

    const role = isAdmin ? 'admin' : (isAgent ? 'agent' : 'admin');
    const { data, error } = await supabase
      .from('clients')
      .insert({
        full_name: name,
        phone,
        whatsapp_number: phone,
        location: form.location.trim() || null,
        status: 'new',
        created_by: user.id,
        created_by_role: role,
      } as any)
      .select('id, client_code, full_name, phone, location')
      .single();
    setSaving(false);

    if (error) {
      const msg = error.message?.includes('clients_phone_unique')
        ? 'Client already exists. Please search instead.'
        : error.message;
      toast({ title: 'Could not create client', description: msg, variant: 'destructive' });
      return;
    }

    const created = data as any as SelectedClient;
    toast({ title: 'Client created', description: `${created.full_name} (${created.client_code})` });
    onCreated(created);
    onOpenChange(false);
    setForm({ full_name: '', phone: '', location: '' });

    if (navigateToProfileOnCreate && isAdmin) {
      navigate(`/admin/clients/${created.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Create New Client</DialogTitle>
          <DialogDescription>Add this client to the CRM. A unique Client ID will be generated automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Wanjiku" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number *</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0712345678" />
            <p className="text-[10px] text-muted-foreground">Phone must be unique. Duplicates are blocked.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Kilimani, Nairobi" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Creating...' : 'Create Client'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
