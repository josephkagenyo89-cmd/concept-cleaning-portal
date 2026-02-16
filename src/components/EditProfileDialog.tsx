import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Pencil, Clock, CheckCircle, XCircle } from 'lucide-react';

export default function EditProfileDialog() {
  const { profile, user, isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    town_estate: '',
    mpesa_number: '',
  });

  useEffect(() => {
    if (!user) return;
    // Check for existing pending request
    supabase
      .from('profile_edit_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setPendingRequest(data[0]);
        }
      });
  }, [user, open]);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name,
        phone: profile.phone,
        town_estate: profile.town_estate,
        mpesa_number: profile.mpesa_number,
      });
    }
  }, [profile]);

  const hasPending = pendingRequest?.status === 'pending';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setLoading(true);

    try {
      // Super Admin: auto-approve by updating directly
      if (isSuperAdmin) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name,
            phone: form.phone,
            town_estate: form.town_estate,
            mpesa_number: form.mpesa_number,
          })
          .eq('user_id', user.id);

        if (error) throw error;
        toast({ title: 'Profile updated', description: 'Your changes have been applied.' });
        setOpen(false);
        return;
      }

      // Others: submit edit request
      const { error } = await supabase
        .from('profile_edit_requests')
        .insert({
          user_id: user.id,
          proposed_data: form,
        });

      if (error) {
        if (error.message.includes('idx_one_pending_per_user')) {
          toast({ title: 'Request exists', description: 'You already have a pending edit request.', variant: 'destructive' });
        } else {
          throw error;
        }
      } else {
        toast({ title: 'Edit request submitted', description: 'Your changes are pending approval.' });
        setPendingRequest({ status: 'pending', proposed_data: form, created_at: new Date().toISOString() });
        setOpen(false);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = pendingRequest && (
    <div className="flex items-center gap-2 mt-2">
      {pendingRequest.status === 'pending' && (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          <Clock className="h-3 w-3 mr-1" /> Edit Pending
        </Badge>
      )}
      {pendingRequest.status === 'approved' && (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" /> Edit Approved
        </Badge>
      )}
      {pendingRequest.status === 'rejected' && (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
          <XCircle className="h-3 w-3 mr-1" /> Edit Rejected
        </Badge>
      )}
    </div>
  );

  return (
    <>
      {statusBadge}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={hasPending}>
            <Pencil className="h-4 w-4 mr-2" /> Edit My Details
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_full_name">Full Name</Label>
              <Input id="edit_full_name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_phone">Phone</Label>
              <Input id="edit_phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_town">Town / Estate</Label>
              <Input id="edit_town" value={form.town_estate} onChange={e => setForm(f => ({ ...f, town_estate: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_mpesa">M-Pesa Number</Label>
              <Input id="edit_mpesa" value={form.mpesa_number} onChange={e => setForm(f => ({ ...f, mpesa_number: e.target.value }))} required />
            </div>
            {!isSuperAdmin && (
              <p className="text-xs text-muted-foreground">Changes will require approval before being applied.</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Submitting...' : isSuperAdmin ? 'Save Changes' : 'Submit for Approval'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
