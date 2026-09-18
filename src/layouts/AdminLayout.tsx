import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, BookOpen, Users, Wallet, CreditCard,
  Settings, BarChart3, LogOut, Sparkles, Menu, X, Megaphone, MessageSquare,
  Receipt, DollarSign, FileText, PieChart, Landmark, Plus, ClipboardList, FolderOpen, UserCheck,
  Settings2, Award, Star, Bug,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import BlockingNoticeModal from '@/components/notices/BlockingNoticeModal';
import { useBlockingNotices } from '@/components/notices/useBlockingNotices';
import { loadAllSettings } from '@/lib/settings';
import { setPdfSettings } from '@/lib/documentPdf';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/admin/bookings', icon: BookOpen, label: 'Bookings' },
  { to: '/admin/book-service', icon: Plus, label: 'Book Service' },
  { to: '/admin/discount-approvals', icon: Wallet, label: 'Discount Approvals' },
  { to: '/admin/discount-reports', icon: PieChart, label: 'Discount Report' },
  { to: '/admin/quotations', icon: ClipboardList, label: 'Quotations' },
  { to: '/admin/documents', icon: FolderOpen, label: 'Documents' },
  { to: '/admin/certificates', icon: Award, label: 'Certificates' },
  { to: '/admin/pest', icon: Bug, label: 'Pest Control' },
  { to: '/admin/feedback', icon: Star, label: 'Feedback' },
  { to: '/admin/agents', icon: Users, label: 'Agents' },
  { to: '/admin/commissions', icon: Wallet, label: 'Commissions' },
  { to: '/admin/payouts', icon: CreditCard, label: 'Payouts' },
  { to: '/admin/services', icon: Settings, label: 'Services' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/admin/clients', icon: UserCheck, label: 'Clients (CRM)' },
  { to: '/admin/notices', icon: Megaphone, label: 'Notices' },
  { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
  { to: '/admin/settings', icon: Settings2, label: 'Settings' },
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

  // Preload system settings into PDF generator + cache on admin entry
  useEffect(() => {
    loadAllSettings(true).then(setPdfSettings).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex bg-background">
      <BlockingNoticeModal notices={blockingNotices} onAcknowledged={refresh} />
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b bg-sidebar text-sidebar-foreground px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/15 ring-1 ring-primary/40 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide">CONCEPT</div>
            <div className="text-[10px] uppercase tracking-[0.15em] opacity-80">Cleaning Services</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:translate-x-0 md:static flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Brand */}
        <div className="hidden md:flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="h-10 w-10 rounded-lg bg-primary/15 ring-1 ring-primary/40 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-extrabold tracking-wide">CONCEPT</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/70">Cleaning Services</div>
            <div className="text-[10px] italic text-sidebar-foreground/60 mt-0.5">Professional. Reliable. Sparkling.</div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 px-3 py-3 mt-14 md:mt-0 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-sidebar-foreground/60 uppercase tracking-[0.15em]">Main</p>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                    : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}

          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-sidebar-foreground/60 uppercase tracking-[0.15em]">ERP & Accounting</p>
          {erpNavItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn('flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                    : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Support card */}
        <div className="px-3 pb-3 mt-auto">
          <div className="rounded-lg bg-sidebar-accent/60 ring-1 ring-sidebar-border p-3 text-center">
            <div className="text-[11px] font-semibold text-sidebar-foreground">Need Support?</div>
            <a href="tel:+254796563741" className="block text-xs text-sidebar-foreground/85 hover:text-sidebar-foreground mt-1">+254 796 563 741</a>
            <a href="mailto:support@conceptcs.co.ke" className="block text-[11px] text-sidebar-foreground/70 hover:text-sidebar-foreground truncate">support@conceptcs.co.ke</a>
          </div>
          <button
            onClick={signOut}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground border border-sidebar-border"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
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
    </div>
  );
}
