import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { CalendarCheck, FileText, LogOut, Wallet, Bell, LifeBuoy, LayoutDashboard } from 'lucide-react';
import { formatKes } from '@/lib/marketplace';
import CustomerLoginPrompt from '@/components/marketplace/CustomerLoginPrompt';

export default function CustomerAccount() {
  const { user, isCustomer, customerClient, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', phone: '', whatsapp_number: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ bookings: 0, documents: 0, feedback: 0 });

  useEffect(() => {
    if (customerClient) {
      setForm({
        full_name: customerClient.full_name || '',
        phone: customerClient.phone || '',
        whatsapp_number: customerClient.whatsapp_number || '',
        location: customerClient.location || '',
      });
    }
  }, [customerClient]);

  useEffect(() => {
    if (!user || !isCustomer) return;
    (async () => {
      const [b, d, f] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('customer_feedback').select('id', { count: 'exact', head: true }),
      ]);
      setStats({ bookings: b.count || 0, documents: d.count || 0, feedback: f.count || 0 });
    })();
  }, [user, isCustomer]);

  if (!isCustomer) return <CustomerLoginPrompt title="My account" />;

    const save = async () => {
    const fullName = form.full_name.trim();
    const phone = form.phone.trim();
    const whatsapp = (form.whatsapp_number || phone).trim();
    const location = form.location.trim();

    if (!fullName || !phone) {
      toast({
        title: 'Missing information',
        description: 'Please enter your full name and phone number.',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    setSaving(true);

    if (customerClient) {
      const { error } = await supabase
        .from('clients')
        .update({
          full_name: fullName,
          phone,
          whatsapp_number: whatsapp,
          location,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', customerClient.id);

      setSaving(false);

      if (error) {
        toast({
          title: 'Could not save profile',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      await refreshProfile();
      toast({ title: 'Profile updated' });
      return;
    }

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

    if (existingClient && existingClient.user_id && existingClient.user_id !== user.id) {
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
            whatsapp_number: whatsapp,
            location,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existingClient.id)
      : await supabase
          .from('clients')
          .insert({
            full_name: fullName,
            phone,
            whatsapp_number: whatsapp,
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
    toast({ title: 'Profile completed' });
   
  };

  return (
    <div className="space-y-4 p-4 md:space-y-6 md:p-6">
      {/* Dashboard */}
      <Card className="bg-market text-market-foreground">
        <CardContent className="p-4">
          <p className="text-xs opacity-80">Welcome back</p>
          <p className="text-lg font-bold">{customerClient?.full_name}</p>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Badge variant="secondary" className="capitalize text-foreground">{customerClient?.status}</Badge>
            {customerClient?.client_code && <span className="opacity-80">{customerClient.client_code}</span>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Card><CardContent className="p-3 text-center">
          <CalendarCheck className="mx-auto h-4 w-4 text-market" />
          <p className="mt-1 text-lg font-bold">{stats.bookings}</p>
          <p className="text-[11px] text-muted-foreground">Bookings</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <FileText className="mx-auto h-4 w-4 text-market" />
          <p className="mt-1 text-lg font-bold">{stats.documents}</p>
          <p className="text-[11px] text-muted-foreground">Documents</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <Wallet className="mx-auto h-4 w-4 text-market" />
          <p className="mt-1 text-sm font-bold">{formatKes(Number(customerClient?.total_spend || 0))}</p>
          <p className="text-[11px] text-muted-foreground">Total spend</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 md:gap-4">
        <Button asChild variant="outline"><Link to="/my/bookings"><CalendarCheck className="mr-2 h-4 w-4" />My bookings</Link></Button>
        <Button asChild variant="outline"><Link to="/my/documents"><FileText className="mr-2 h-4 w-4" />My documents</Link></Button>
        <Button asChild variant="outline"><Link to="/my/messages"><Bell className="mr-2 h-4 w-4" />Notifications</Link></Button>
        <Button asChild variant="outline"><Link to="/my/support"><LifeBuoy className="mr-2 h-4 w-4" />Support</Link></Button>
        <Button asChild variant="outline"><Link to="/my"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link></Button>
        <Button variant="outline" onClick={async () => { await signOut(); navigate('/'); }}>
          <LogOut className="mr-2 h-4 w-4" />Sign out
        </Button>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">My profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="c_name">Full name</Label>
            <Input id="c_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c_phone">Phone</Label>
            <Input id="c_phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c_wa">WhatsApp number</Label>
            <Input id="c_wa" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c_loc">Location</Label>
            <Input id="c_loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <Button onClick={save} disabled={saving} className="w-full bg-market text-market-foreground hover:bg-market/90">
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
