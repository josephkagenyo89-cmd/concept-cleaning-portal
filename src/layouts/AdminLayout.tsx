import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, BookOpen, Users, Wallet, CreditCard, ClipboardCheck,
  Settings, BarChart3, LogOut, Sparkles, Menu, X, Megaphone, MessageSquare,
  FileText, PieChart, FolderOpen, UserCheck, Settings2, Award, Star, Bug,
  Inbox, Briefcase, Building2, IdCard, Newspaper, Activity, Calculator,
  ChevronDown, PanelLeftClose, PanelLeftOpen, Search, Bell, Handshake,
  CalendarDays, ReceiptText, UserRound,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import BlockingNoticeModal from '@/components/notices/BlockingNoticeModal';
import { useBlockingNotices } from '@/components/notices/useBlockingNotices';
import { loadAllSettings } from '@/lib/settings';
import { setPdfSettings } from '@/lib/documentPdf';
import { requestBrowserNotificationPermission } from '@/lib/customerNotifications';

type NavItem = { to: string; icon: ComponentType<{ className?: string }>; label: string; end?: boolean };
const navGroups: { label: string; items: NavItem[] }[] = [
  { label: 'Workspace', items: [
    { to: '/admin/approval-centre', icon: ClipboardCheck, label: 'Approval Centre' },
  ]},
  { label: 'Sales & CRM', items: [
    { to: '/admin/leads', icon: UserCheck, label: 'Leads' },
    { to: '/admin/guest-requests', icon: Inbox, label: 'Guest Requests' },
    { to: '/admin/clients', icon: Users, label: 'Clients' },
    { to: '/admin/quotations', icon: FileText, label: 'Quotations' },
    { to: '/admin/contracts', icon: Handshake, label: 'Commercial Contracts' },
  ]},
  { label: 'Operations', items: [
    { to: '/admin/bookings', icon: BookOpen, label: 'Bookings' },
    { to: '/admin/book-service', icon: CalendarDays, label: 'Create Booking' },
    { to: '/admin/booking-engine', icon: Settings2, label: 'Smart Booking Engine' },
    { to: '/admin/sponsored-campaigns', icon: Megaphone, label: 'Sponsored Campaigns' },
    { to: '/admin/pest', icon: Bug, label: 'Pest Control' },
    { to: '/admin/documents', icon: FolderOpen, label: 'Documents' },
    { to: '/admin/certificates', icon: Award, label: 'Certificates' },
    { to: '/admin/feedback', icon: Star, label: 'Feedback' },
  ]},
  { label: 'Finance', items: [
    { to: '/admin/discount-approvals', icon: Wallet, label: 'Discount Approvals' },
    { to: '/admin/discount-reports', icon: PieChart, label: 'Discount Reports' },
    { to: '/admin/commissions', icon: ReceiptText, label: 'Commissions' },
    { to: '/admin/payouts', icon: CreditCard, label: 'Payouts' },
  ]},
  { label: 'People', items: [
    { to: '/admin/agents', icon: Users, label: 'Agents' },
    { to: '/admin/hr', icon: Briefcase, label: 'HR Dashboard' },
    { to: '/admin/hr/employees', icon: UserRound, label: 'Employees' },
    { to: '/admin/hr/departments', icon: Building2, label: 'Departments' },
    { to: '/admin/hr/positions', icon: IdCard, label: 'Positions' },
    { to: '/admin/hr/payroll', icon: Wallet, label: 'Payroll' },
  ]},
  { label: 'Insights & Setup', items: [
    { to: '/admin/services', icon: Settings, label: 'Services' },
    { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/admin/notices', icon: Megaphone, label: 'Notices' },
    { to: '/admin/blog', icon: Newspaper, label: 'Blog' },
    { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
    { to: '/admin/settings', icon: Settings2, label: 'Settings' },
  ]},
];
const accountingNavItems = [
  ['overview', 'Financial Overview'], ['general-ledger', 'General Ledger'],
  ['sales-revenue', 'Sales & Revenue'], ['expenses-purchases', 'Expenses & Purchases'],
  ['banking-cash', 'Banking & Cash'], ['accounts-receivable', 'Accounts Receivable'],
  ['accounts-payable', 'Accounts Payable'], ['assets-depreciation', 'Assets & Depreciation'],
  ['budgets-planning', 'Budgets & Planning'], ['financial-reports', 'Financial Reports'],
  ['tax-compliance', 'Tax & Compliance'], ['accounting-periods', 'Accounting Periods'],
  ['accounting-settings', 'Accounting Settings'], ['approvals', 'Accounting Approvals'],
] as const;
const allNavItems = navGroups.flatMap((group) => group.items);
const pageTitleFor = (pathname: string) => {
  const finance = accountingNavItems.find(([section]) => pathname === `/admin/accounting/${section}`);
  if (finance) return finance[1];
  const item = [...allNavItems].sort((a, b) => b.to.length - a.to.length)
    .find((entry) => entry.end ? pathname === entry.to : pathname === entry.to || pathname.startsWith(`${entry.to}/`));
  return item?.label || 'Business Workspace';
};

export default function AdminLayout() {
  const { signOut, isAdmin, isSuperAdmin, profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountingExpanded, setAccountingExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const location = useLocation();
  const { blockingNotices, refresh } = useBlockingNotices();

  useEffect(() => {
    if (location.pathname.startsWith('/admin/accounting')) setAccountingExpanded(true);
    const activeGroup = navGroups.find((group) => group.items.some((item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)));
    if (activeGroup) setExpandedGroups((current) => ({ ...current, [activeGroup.label]: true }));
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => { loadAllSettings(true).then(setPdfSettings).catch(() => {}); }, []);
  useEffect(() => {
    if (!isAdmin || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') requestBrowserNotificationPermission();
  }, [isAdmin]);

  const pageTitle = useMemo(() => pageTitleFor(location.pathname), [location.pathname]);
  const initials = profile?.full_name?.trim()?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    return <NavLink key={item.to} to={item.to} end={item.end} title={sidebarCollapsed ? item.label : undefined}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) => cn('group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
        isActive ? 'bg-[#EAF1FC] text-[#0B3D91] shadow-[inset_3px_0_0_#0B3D91]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
        sidebarCollapsed && 'justify-center px-2')}>
      <Icon className="h-[17px] w-[17px] shrink-0" />
      {!sidebarCollapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
    </NavLink>;
  };

  return <div className={cn('erp-workspace flex min-h-screen w-full bg-[#F6F8FB] text-slate-800', sidebarCollapsed && 'erp-sidebar-collapsed')}>
    <BlockingNoticeModal notices={blockingNotices} onAcknowledged={refresh} />
    {sidebarOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/40 md:hidden" onClick={() => setSidebarOpen(false)} />}

    <aside className={cn('erp-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(84vw,300px)] flex-col border-r border-slate-200 bg-white transition-[transform,width] duration-200 md:sticky md:top-0 md:h-screen md:w-64 md:translate-x-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full', sidebarCollapsed && 'md:w-[76px]')}>
      <div className={cn('flex h-[68px] shrink-0 items-center gap-3 border-b border-slate-200 px-4', sidebarCollapsed && 'md:justify-center md:px-2')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B3D91] text-white shadow-sm"><Sparkles className="h-[18px] w-[18px]" /></div>
        {!sidebarCollapsed && <div className="min-w-0 leading-tight"><div className="truncate text-sm font-bold tracking-[0.08em] text-slate-900">CONCEPT</div><div className="mt-1 truncate text-[10px] font-medium uppercase tracking-[0.13em] text-slate-500">Business workspace</div></div>}
        <button type="button" aria-label="Close navigation" className="ml-auto rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden" onClick={() => setSidebarOpen(false)}><X className="h-4 w-4" /></button>
      </div>

      <div className={cn('border-b border-slate-100 px-3 py-3', sidebarCollapsed && 'md:px-2')}>
        <NavLink to="/admin" end title={sidebarCollapsed ? 'Business Overview' : undefined} onClick={() => setSidebarOpen(false)}
          className={({ isActive }) => cn('flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
            isActive ? 'bg-[#0B3D91] text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100', sidebarCollapsed && 'md:justify-center md:px-2')}>
          <LayoutDashboard className="h-[17px] w-[17px] shrink-0" />{!sidebarCollapsed && <span>Business Overview</span>}
        </NavLink>
      </div>

      <nav aria-label="ERP modules" className="erp-sidebar-nav min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const expanded = expandedGroups[group.label] !== false;
          const hasActive = group.items.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
          return <section key={group.label}>
            {!sidebarCollapsed
              ? <button type="button" aria-expanded={expanded} onClick={() => setExpandedGroups((current) => ({ ...current, [group.label]: !expanded }))}
                  className={cn('mb-1 flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] transition-colors',
                    hasActive ? 'text-[#0B3D91]' : 'text-slate-400 hover:text-slate-700')}>
                  {group.label}<ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
                </button>
              : <div className="mx-auto mb-2 h-px w-8 bg-slate-200" title={group.label} />}
            {(expanded || sidebarCollapsed) && <div className="space-y-1">{group.items.map(renderNavItem)}</div>}
          </section>;
        })}
        {isSuperAdmin && <section>{!sidebarCollapsed && <p className="mb-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">System</p>}
          {renderNavItem({ to: '/admin/system-monitoring', icon: Activity, label: 'System Monitoring' })}</section>}
        <section>
          {!sidebarCollapsed
            ? <button type="button" aria-expanded={accountingExpanded} onClick={() => setAccountingExpanded((value) => !value)}
                className={cn('mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
                  location.pathname.startsWith('/admin/accounting') ? 'bg-[#EAF1FC] text-[#0B3D91]' : 'text-slate-600 hover:bg-slate-100')}>
                <Calculator className="h-[17px] w-[17px] shrink-0" /><span className="flex-1 text-left">Finance workspace</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', accountingExpanded && 'rotate-180')} />
              </button>
            : <NavLink to="/admin/accounting/overview" title="Finance workspace" className="flex min-h-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><Calculator className="h-[17px] w-[17px]" /></NavLink>}
          {accountingExpanded && !sidebarCollapsed && <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-3">
            {accountingNavItems.map(([section, label]) => <NavLink key={section} to={`/admin/accounting/${section}`} onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn('block rounded-md px-3 py-2 text-xs transition-colors',
                isActive ? 'bg-[#EAF1FC] font-semibold text-[#0B3D91]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900')}>{label}</NavLink>)}
          </div>}
        </section>
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3">
        {!sidebarCollapsed && <div className="mb-3 rounded-xl bg-slate-50 p-3">
          <div className="text-[11px] font-semibold text-slate-700">Need support?</div>
          <a href="tel:+254796563741" className="mt-1 block text-xs text-slate-600 hover:text-[#0B3D91]">+254 796 563 741</a>
          <a href="mailto:support@conceptcs.co.ke" className="mt-1 block truncate text-[11px] text-slate-500 hover:text-[#0B3D91]">support@conceptcs.co.ke</a>
        </div>}
        <button type="button" onClick={signOut} title={sidebarCollapsed ? 'Sign out' : undefined}
          className={cn('flex min-h-10 w-full items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700',
            sidebarCollapsed && 'justify-center px-2')}>
          <LogOut className="h-4 w-4 shrink-0" />{!sidebarCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>

    <main className="erp-main min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex h-[64px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:px-5 lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" aria-label="Open navigation" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 md:hidden" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></button>
          <button type="button" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 md:inline-flex" onClick={() => setSidebarCollapsed((value) => !value)}>
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <div className="min-w-0"><div className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:block">Concept Cleaning Services</div><h1 className="truncate text-sm font-semibold text-slate-900 sm:mt-0.5 sm:text-base">{pageTitle}</h1></div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <NavLink to="/admin/clients" aria-label="Search clients" title="Search clients" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"><Search className="h-4 w-4" /></NavLink>
          <NavLink to="/admin/approval-centre" aria-label="Approval centre" title="Approval centre" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"><Bell className="h-4 w-4" /></NavLink>
          <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF1FC] text-xs font-bold text-[#0B3D91]">{initials}</div>
            <div className="hidden max-w-[150px] sm:block"><p className="truncate text-xs font-semibold text-slate-800">{profile?.full_name || 'Workspace user'}</p><p className="text-[10px] text-slate-500">{isSuperAdmin ? 'Super Admin' : isAdmin ? 'Administrator' : 'Staff'}</p></div>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6"><Outlet /></div>
    </main>
  </div>;
}
