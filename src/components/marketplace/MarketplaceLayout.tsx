import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, CalendarCheck, Bell, User, Sparkles, Globe, LogIn, Building2, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
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
    <div className="min-h-screen bg-background pb-32 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-market text-market-foreground shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 md:px-6 md:py-4">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            {settings.general.logo_url ? (
              <img src={settings.general.logo_url} alt={company} className="h-9 w-9 rounded-lg bg-white/10 object-contain md:h-11 md:w-11" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 md:h-11 md:w-11">
                <Sparkles className="h-5 w-5" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight md:text-base">{company}</span>
              <span className="block text-[11px] leading-tight opacity-80 md:text-xs">Trusted cleaning marketplace</span>
            </span>
          </Link>

          {/* Desktop primary navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {[...NAV, ...DESKTOP_EXTRA].map((item) => (
              <NavLink
                key={item.to + item.label}
                to={item.to}
                end={(item as any).end}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/20' : 'hover:bg-white/10'
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
                <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 text-market-foreground hover:bg-white/15">
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
                className="h-9 bg-white/15 px-3 text-xs font-semibold text-market-foreground hover:bg-white/25"
                onClick={() => navigate(`/customer-auth?next=${encodeURIComponent(location.pathname)}`)}
              >
                <LogIn className="mr-1 h-4 w-4" /> Login
              </Button>
            )}

            <a
              href="https://conceptcleaningke.lovable.app/admin"
              target="_blank"
              rel="noopener noreferrer"
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
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card md:hidden">
        <nav className="mx-auto flex max-w-3xl items-stretch">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-market' : 'text-muted-foreground'
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

        <div className="mx-auto max-w-3xl border-t bg-muted/40 px-4 py-2">
          <a
            href="https://conceptcleaningke.lovable.app/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2 text-xs font-semibold text-foreground"
          >
            <Building2 className="h-4 w-4" /> Staff Login
          </a>
        </div>

      </div>
    </div>
  );
}
