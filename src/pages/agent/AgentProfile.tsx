import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TierBadge from '@/components/agent/TierBadge';
import { getTier } from '@/lib/commission';
import { LogOut, User, Phone, MapPin, CreditCard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function AgentProfile() {
  const { profile, signOut, user } = useAuth();
  const [cumulativeRevenue, setCumulativeRevenue] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('bookings')
      .select('price')
      .eq('agent_id', user.id)
      .eq('status', 'completed')
      .then(({ data }) => {
        setCumulativeRevenue((data || []).reduce((s, b) => s + Number(b.price), 0));
      });
  }, [user]);

  const tier = getTier(cumulativeRevenue);

  if (!profile) return null;

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{profile.full_name}</CardTitle>
            <TierBadge tier={tier} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{profile.phone}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span>M-Pesa: {profile.mpesa_number}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{profile.town_estate}</span>
          </div>
          {profile.referral_code && (
            <div className="flex items-center gap-3 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Referral: {profile.referral_code}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="destructive" className="w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}
