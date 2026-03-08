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
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
