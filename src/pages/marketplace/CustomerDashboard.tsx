import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarCheck, FileText, ReceiptText, Award, Bell, MessageCircle, LifeBuoy, Star,
  User, Wallet, ClipboardList, Sparkles,
} from 'lucide-react';
import { formatKes } from '@/lib/marketplace';
import CustomerLoginPrompt from '@/components/marketplace/CustomerLoginPrompt';

const SHORTCUTS = [
  { to: '/my/bookings', label: 'My Bookings', icon: CalendarCheck, hint: 'Status & history' },
  { to: '/my/bookings?tab=quotations', label: 'My Quotations', icon: ClipboardList, hint: 'Requests & prices' },
  { to: '/my/documents?tab=invoices', label: 'My Invoices', icon: FileText, hint: 'Amounts due' },
  { to: '/my/documents?tab=receipts', label: 'My Receipts', icon: ReceiptText, hint: 'Payment proof' },
  { to: '/my/documents?tab=certificates', label: 'Certificates', icon: Award, hint: 'Service completion' },
  { to: '/my/messages', label: 'Notifications', icon: Bell, hint: 'Updates from us' },
  { to: '/my/messages', label: 'Messages', icon: MessageCircle, hint: 'Talk to our team' },
  { to: '/my/support', label: 'Customer Support', icon: LifeBuoy, hint: 'Call or WhatsApp' },
  { to: '/my/bookings', label: 'Feedback', icon: Star, hint: 'Rate a service' },
  { to: '/my/account', label: 'My Profile', icon: User, hint: 'Your details' },
];

export default function CustomerDashboard() {
  const { user, isCustomer, customerClient } = useAuth();
  const [stats, setStats] = useState({ bookings: 0, quotations: 0, invoices: 0, certificates: 0 });

  useEffect(() => {
    if (!user || !isCustomer) return;
    (async () => {
      const [b, q, i, c] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('quotations').select('id', { count: 'exact', head: true }),
        supabase.from('invoices').select('id', { count: 'exact', head: true }),
        supabase.from('service_certificates').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        bookings: b.count || 0,
        quotations: q.count || 0,
        invoices: i.count || 0,
        certificates: c.count || 0,
      });
    })();
  }, [user, isCustomer]);

  if (!isCustomer) return <CustomerLoginPrompt title="My dashboard" />;

  return (
    <div className="space-y-4 p-4">
      <Card className="bg-market text-market-foreground">
        <CardContent className="p-4">
          <p className="text-xs opacity-80">Welcome back</p>
          <p className="text-lg font-bold">{customerClient?.full_name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary" className="capitalize text-foreground">{customerClient?.status}</Badge>
            {customerClient?.client_code && <span className="opacity-90">Client ID: {customerClient.client_code}</span>}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs opacity-90">
            <Wallet className="h-3.5 w-3.5" /> Total spend: {formatKes(Number(customerClient?.total_spend || 0))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Bookings', value: stats.bookings },
          { label: 'Quotes', value: stats.quotations },
          { label: 'Invoices', value: stats.invoices },
          { label: 'Certs', value: stats.certificates },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button asChild className="w-full bg-market text-market-foreground hover:bg-market/90">
        <Link to="/"><Sparkles className="mr-2 h-4 w-4" /> Book a new service</Link>
      </Button>

      <div className="grid grid-cols-2 gap-3">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="rounded-xl border bg-card p-3 transition-colors hover:border-market"
          >
            <s.icon className="h-4 w-4 text-market" />
            <p className="mt-1.5 text-sm font-semibold leading-tight">{s.label}</p>
            <p className="text-[11px] text-muted-foreground">{s.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
