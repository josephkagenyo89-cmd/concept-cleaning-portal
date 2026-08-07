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
