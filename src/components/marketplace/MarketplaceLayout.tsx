import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, CalendarCheck, Bell, User, Sparkles, Globe, LogIn, Building2, FileText, Sun, Moon, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CustomerCareButton from '@/components/marketplace/CustomerCareButton';
import InstallAppPrompt from '@/components/marketplace/InstallAppPrompt';
import { countUnread } from '@/lib/customerNotifications';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
];

const NAV: { to: string; label: string; icon: typeof Home; end?: boolean; badge?: boolean }[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
  { to: '/my/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/my/notifications', label: 'Alerts', icon: Bell, badge: true },
  { to: '/my', label: 'Profile', icon: User },
];

/** Extra desktop-only destinations — bottom nav stays lean on mobile. */
const DESKTOP_EXTRA = [{ to: '/my/documents', label: 'Documents', icon: FileText }];


export default function MarketplaceLayout() {
  const { settings } = useSettings();
  const { theme, setTheme } = useTheme();
  const { user, isCustomer, customerClient } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState(() => localStorage.getItem('ccs_market_lang') || 'en');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    localStorage.setItem('ccs_market_lang', lang);
  }, [lang]);

  useEffect(() => {
    if (!isCustomer) { setUnread(0); return; }
    let active = true;
    const refresh = () => { countUnread().then((n) => { if (active) setUnread(n); }); };
    refresh();
    const id = window.setInterval(refresh, 60000);
    window.addEventListener('ccs-notifications-changed', refresh);
    return () => {
      active = false;
      window.clearInterval(id);
      window.removeEventListener('ccs-notifications-changed', refresh);
    };
  }, [isCustomer, location.pathname]);


  const company = settings.general.company_name || 'Concept Cleaning Services';
  const activeLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-[#0F766E] text-white shadow-[0_8px_24px_rgba(51,51,51,0.12)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 md:px-6 md:py-4">
          <div className="flex min-w-0 items-center gap-2 md:min-w-[230px]">
            {location.pathname !== '/marketplace' && location.pathname !== '/categories' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 shrink-0 rounded-full bg-white/10 px-0 text-white hover:bg-white/15 md:h-10 md:w-10"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Link to="/marketplace" className="flex min-w-0 items-center gap-2.5" aria-label={`${company} marketplace`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0F766E] text-[#333333] shadow-sm">
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-[190px] truncate text-sm font-extrabold leading-tight tracking-wide text-white">{company}</span>
                <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em] text-[#F97316]">Services marketplace</span>
              </span>
            </Link>
          </div>

          {/* Desktop primary navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {[...NAV, ...DESKTOP_EXTRA].map((item) => (
              <NavLink
                key={item.to + item.label}
                to={item.to}
                end={(item as any).end}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-[#0F766E]/15 text-[#F97316]' : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {(item as any).badge && unread > 0 && (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-white hover:bg-white/15">
                  <Globe className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase">{activeLang.code}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {LANGUAGES.map((l) => (
                  <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)}>
                    {l.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 px-0 text-white hover:bg-white/15"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {isCustomer ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 gap-1 px-2 text-market-foreground hover:bg-white/15"
                onClick={() => navigate('/my')}
              >
                <User className="h-4 w-4" />
                <span className="max-w-[80px] truncate text-xs font-medium md:max-w-[140px] md:text-sm">
                  {customerClient?.full_name?.split(' ')[0] || 'Account'}
                </span>
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-9 rounded-full border border-[#0F766E]/70 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20"
                onClick={() => navigate(`/customer-auth?next=${encodeURIComponent(location.pathname)}`)}
              >
                <LogIn className="mr-1 h-4 w-4" /> Login
              </Button>
            )}

            <a
              href="/admin"
              className="hidden items-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-xs font-semibold hover:bg-white/10 md:flex"
            >
              <Building2 className="h-4 w-4" /> Staff Login
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl">
        <Outlet />
      </main>

      <CustomerCareButton />
      <InstallAppPrompt />

      {/* Bottom navigation + staff login (mobile only) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E2E8F0] bg-white/95 shadow-[0_-8px_24px_rgba(51,51,51,0.06)] backdrop-blur md:hidden">
        <nav className="mx-auto flex max-w-3xl items-stretch">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? 'font-bold text-[#0F766E]' : 'text-[#475569] hover:text-[#0F766E]'
                }`
              }
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge && unread > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mx-auto max-w-3xl border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
          <a
            href="/admin"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#0F766E] bg-[#0F766E] py-2.5 text-xs font-semibold text-white"
          >
            <Building2 className="h-4 w-4" /> Staff Login
          </a>
        </div>

      </div>
    </div>
  );
}
