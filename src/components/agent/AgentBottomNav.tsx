import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, Wallet, User, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const links = [
  { to: '/agent', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/agent/book', icon: PlusCircle, label: 'Book' },
  { to: '/agent/messages', icon: MessageCircle, label: 'Messages' },
  { to: '/agent/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/agent/profile', icon: User, label: 'Profile' },
];

export default function AgentBottomNav() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      // Get agent's conversation
      const { data: convo } = await supabase
        .from('conversations')
        .select('id')
        .eq('agent_id', user.id)
        .single();
      if (!convo) return;
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', convo.id)
        .eq('sender_role', 'admin')
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };
    fetchUnread();

    const channel = supabase
      .channel('agent-unread-nav')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="flex justify-around py-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/agent'}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors',
                isActive ? 'text-primary font-medium' : 'text-muted-foreground')
            }
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {label === 'Messages' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
