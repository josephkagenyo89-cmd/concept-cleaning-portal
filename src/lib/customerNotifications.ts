import { supabase } from '@/integrations/supabase/client';

export interface CustomerNotification {
  id: string;
  user_id: string;
  client_id: string | null;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export function formatCurrencyForNotification(amount: number): string {
  return `KES ${Number(amount || 0).toLocaleString('en-KE', {
    maximumFractionDigits: 0,
  })}`;
}

export function buildAdminBookingNotificationBody(input: {
  clientName: string;
  serviceName: string;
  date: string;
  time?: string;
  location: string;
  price: number;
}): string {
  const formattedDate = input.date
    ? new Date(input.date).toLocaleDateString('en-KE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'your selected date';

  const timeSegment = input.time ? ` at ${input.time}` : '';

  return `${input.clientName} requested ${input.serviceName} for ${formattedDate}${timeSegment} in ${input.location}. Estimated total: ${formatCurrencyForNotification(input.price)}.`;
}

export function requestBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  return Notification.requestPermission();
}

export function triggerBrowserNotification(title: string, body: string): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: 'concept-cleaning-booking',
  });

  notification.onclick = () => {
    window.focus();
    window.location.href = '/admin/bookings';
  };

  return true;
}

export async function listNotifications(): Promise<CustomerNotification[]> {
  const { data } = await supabase
    .from('customer_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  return (data as CustomerNotification[] | null) || [];
}

export async function countUnread(): Promise<number> {
  const { count } = await supabase
    .from('customer_notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  return count || 0;
}

export async function markRead(id: string) {
  await supabase.from('customer_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
}

export async function markAllRead() {
  await supabase
    .from('customer_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
}

export async function deleteNotification(id: string) {
  await supabase.from('customer_notifications').delete().eq('id', id);
}

export async function listAdminUserIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['admin', 'super_admin']);

  if (error) {
    console.error('Could not load admin recipients for notification:', error);
    return [];
  }

  return [...new Set((data || []).map((row: any) => row.user_id).filter(Boolean))];
}

export async function pushNotificationToUsers(input: {
  user_ids: string[];
  client_id?: string | null;
  type?: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const uniqueIds = [...new Set((input.user_ids || []).filter(Boolean))];

  if (!uniqueIds.length) return [];

  const rows = uniqueIds.map((user_id) => ({
    user_id,
    client_id: input.client_id ?? null,
    type: input.type || 'general',
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  }));

  const { data, error } = await supabase.from('customer_notifications').insert(rows).select('id');

  if (error) {
    console.error('Could not notify admin users:', error);
    return [];
  }

  return data || [];
}

export async function notifyAdminsOfBooking(input: {
  clientName: string;
  serviceName: string;
  date: string;
  time?: string;
  location: string;
  price: number;
}) {
  const adminUserIds = await listAdminUserIds();

  if (!adminUserIds.length) return [];

  const body = buildAdminBookingNotificationBody(input);

  triggerBrowserNotification(`New ${input.serviceName} booking`, body);

  return pushNotificationToUsers({
    user_ids: adminUserIds,
    type: 'booking',
    title: `New ${input.serviceName} booking`,
    body,
    link: '/admin/bookings',
  });
}

/** Used for portal-generated notices such as "account created". */
export async function pushNotification(input: {
  user_id: string;
  client_id?: string | null;
  type?: string;
  title: string;
  body?: string;
  link?: string;
}) {
  await supabase.from('customer_notifications').insert({
    user_id: input.user_id,
    client_id: input.client_id ?? null,
    type: input.type || 'general',
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
}
