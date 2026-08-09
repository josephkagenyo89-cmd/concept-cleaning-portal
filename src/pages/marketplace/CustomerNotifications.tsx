import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Trash2, CheckCheck, Mail, MailOpen } from 'lucide-react';
import CustomerLoginPrompt from '@/components/marketplace/CustomerLoginPrompt';
import {
  CustomerNotification,
  deleteNotification,
  listNotifications,
  markAllRead,
  markRead,
} from '@/lib/customerNotifications';

export default function CustomerNotifications() {
  const { isCustomer } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setItems(await listNotifications());
    setLoading(false);
  };

  useEffect(() => {
    if (!isCustomer) { setLoading(false); return; }
    load();
  }, [isCustomer]);

  if (!isCustomer) return <CustomerLoginPrompt title="Notifications" />;

  const unread = items.filter((n) => !n.read_at).length;

  const open = async (n: CustomerNotification) => {
    if (!n.read_at) {
      await markRead(n.id);
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)));
      window.dispatchEvent(new Event('ccs-notifications-changed'));
    }
    if (n.link) navigate(n.link);
  };

  const remove = async (id: string) => {
    await deleteNotification(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    window.dispatchEvent(new Event('ccs-notifications-changed'));
  };

  const readAll = async () => {
    await markAllRead();
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at || now })));
    window.dispatchEvent(new Event('ccs-notifications-changed'));
  };

  return (
    <div className="space-y-4 p-4 md:space-y-6 md:p-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-base font-bold">
            Notifications
            {unread > 0 && <Badge className="bg-market text-market-foreground">{unread} new</Badge>}
          </h1>
          <p className="text-xs text-muted-foreground">Updates about your bookings, quotations and documents.</p>
        </div>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={readAll}>
            <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading notifications…</p>}

      {!loading && items.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          <Bell className="mx-auto mb-2 h-6 w-6 text-market" />
          You have no notifications yet.
        </CardContent></Card>
      )}

      {items.map((n) => (
        <Card key={n.id} className={n.read_at ? '' : 'border-market/60 bg-market/5'}>
          <CardContent className="flex items-start gap-3 p-4">
            <button onClick={() => open(n)} className="flex-1 space-y-1 text-left">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {n.read_at ? <MailOpen className="h-4 w-4 text-muted-foreground" /> : <Mail className="h-4 w-4 text-market" />}
                {n.title}
              </p>
              {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
              <p className="text-[11px] text-muted-foreground">
                <span className="capitalize">{n.type}</span> · {new Date(n.created_at).toLocaleString()}
              </p>
            </button>
            <Button size="icon" variant="ghost" aria-label="Delete notification" onClick={() => remove(n.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
