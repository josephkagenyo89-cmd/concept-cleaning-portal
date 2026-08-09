import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, MessageCircle } from 'lucide-react';
import CustomerLoginPrompt from '@/components/marketplace/CustomerLoginPrompt';

export default function CustomerMessages() {
  const { user, isCustomer, customerClient } = useAuth();
  const { settings } = useSettings();
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isCustomer) { setLoading(false); return; }
    supabase
      .from('notices')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setNotices(data || []);
        setLoading(false);
      });
  }, [user, isCustomer]);

  if (!isCustomer) return <CustomerLoginPrompt title="Messages & notifications" />;

  const supportPhone = (settings.general.phone || '+254796563741').replace(/[^0-9]/g, '');
  const waLink = `https://wa.me/${supportPhone}?text=${encodeURIComponent(
    `Hello ${settings.general.company_name}, this is ${customerClient?.full_name || 'a customer'}. I need help with a service.`
  )}`;

  return (
    <div className="space-y-4 p-4 md:space-y-6 md:p-6">
      <div>
        <h1 className="text-base font-bold">Messages &amp; notifications</h1>
        <p className="text-xs text-muted-foreground">Updates from our team.</p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <MessageCircle className="h-5 w-5 text-market" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Chat with support</p>
            <p className="text-xs text-muted-foreground">We reply on WhatsApp within business hours.</p>
          </div>
          <Button asChild size="sm" className="bg-market text-market-foreground hover:bg-market/90">
            <a href={waLink} target="_blank" rel="noreferrer">Chat</a>
          </Button>
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted-foreground">Loading notifications…</p>}
      {!loading && notices.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          No notifications right now.
        </CardContent></Card>
      )}
      {notices.map((n) => (
        <Card key={n.id}>
          <CardContent className="space-y-1 p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Bell className="h-4 w-4 text-market" /> {n.title}
              </p>
              <Badge variant="outline" className="capitalize">{n.priority}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{n.message}</p>
            <p className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
