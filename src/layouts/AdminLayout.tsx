import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AiChatAssistant from '@/components/AiChatAssistant';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, BookOpen, Users, Wallet, CreditCard,
  Settings, BarChart3, LogOut, Sparkles, Menu, X, Megaphone, MessageSquare,
  Receipt, DollarSign, FileText, PieChart, Landmark, Plus, ClipboardList, FolderOpen,
} from 'lucide-react';
import { useState } from 'react';
import BlockingNoticeModal from '@/components/notices/BlockingNoticeModal';
import { useBlockingNotices } from '@/components/notices/useBlockingNotices';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/admin/bookings', icon: BookOpen, label: 'Bookings' },
  { to: '/admin/book-service', icon: Plus, label: 'Book Service' },
  { to: '/admin/quotations', icon: ClipboardList, label: 'Quotations' },
  { to: '/admin/documents', icon: FolderOpen, label: 'Documents' },
  { to: '/admin/agents', icon: Users, label: 'Agents' },
  { to: '/admin/commissions', icon: Wallet, label: 'Commissions' },
  { to: '/admin/payouts', icon: CreditCard, label: 'Payouts' },
  { to: '/admin/services', icon: Settings, label: 'Services' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/admin/notices', icon: Megaphone, label: 'Notices' },
  { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
];

const erpNavItems = [
  { to: '/admin/erp', icon: Landmark, label: 'Finance Dashboard', end: true },
  { to: '/admin/erp/income', icon: DollarSign, label: 'Income' },
  { to: '/admin/erp/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/admin/erp/invoices', icon: FileText, label: 'Invoices' },
  { to: '/admin/erp/reports', icon: PieChart, label: 'Reports' },
];

export default function AdminLayout() {
  const { signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { blockingNotices, refresh } = useBlockingNotices();

  return (
    <div className="min-h-screen flex bg-background">
      <BlockingNoticeModal notices={blockingNotices} onAcknowledged={refresh} />
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-bold">Concept Admin</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-60 border-r bg-card transition-transform md:translate-x-0 md:static',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center gap-2 border-b px-4 py-4 hidden md:flex">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-bold">Concept Admin</span>
        </div>
        <nav className="flex flex-col gap-1 p-3 mt-14 md:mt-0 overflow-y-auto max-h-[calc(100vh-60px)]">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
          <div className="pt-3 mt-3 border-t">
            <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">ERP & Accounting</p>
            {erpNavItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
          <div className="mt-auto pt-4 border-t">
            <button
              onClick={signOut}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted w-full"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </nav>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto mt-14 md:mt-0">
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <AiChatAssistant />
    </div>
  );
}
