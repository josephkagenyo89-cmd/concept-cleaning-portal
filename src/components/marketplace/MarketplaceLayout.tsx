import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, CalendarCheck, Bell, User, Sparkles, Globe, LogIn, Building2, FileText, Sun, Moon, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
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
  const [promoVisible, setPromoVisible] = useState(() => localStorage.getItem('ccs_market_promo_dismissed') !== '1');
  const [promoDrag, setPromoDrag] = useState(0);
  const promoDragStart = useRef<number | null>(null);

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

  const dismissPromo = () => {
    setPromoVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ccs_market_promo_dismissed', '1');
    }
  };

  const handlePromoPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    promoDragStart.current = event.clientX;
  };

  const handlePromoPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (promoDragStart.current === null) return;
    const delta = event.clientX - promoDragStart.current;
    setPromoDrag(Math.max(-180, Math.min(180, delta)));
  };

  const handlePromoPointerEnd = () => {
    if (Math.abs(promoDrag) > 110) {
      dismissPromo();
    } else {
      setPromoDrag(0);
    }
    promoDragStart.current = null;
  };

  return (
    <div className="min-h-screen bg-background pb-32 md:pb-10">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-market text-market-foreground shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 md:px-6 md:py-4">
          <div className="flex min-w-0 items-center gap-2">
            {location.pathname !== '/marketplace' && location.pathname !== '/categories' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 rounded-full bg-white/10 px-0 text-market-foreground hover:bg-white/15 md:h-10 md:w-10"
                onClick={() => navigate(-1)}
                aria-label="Go back"
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
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

            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 px-0 text-market-foreground hover:bg-white/15"
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
                className="h-9 bg-white/15 px-3 text-xs font-semibold text-market-foreground hover:bg-white/25"
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

      {promoVisible && (
        <div className="px-4 pt-3 md:px-6">
          <div
            className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-4 py-3 text-white shadow-lg shadow-emerald-600/20"
            style={{
              transform: `translateX(${promoDrag}px)`,
              transition: promoDrag === 0 ? 'transform 0.22s ease' : 'none',
              touchAction: 'pan-y',
            }}
            onPointerDown={handlePromoPointerDown}
            onPointerMove={handlePromoPointerMove}
            onPointerUp={handlePromoPointerEnd}
            onPointerLeave={handlePromoPointerEnd}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold">%</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight md:text-base">Enjoy up to KES 2,000 off a service</p>
                  <p className="text-[11px] text-emerald-50/90 md:text-xs">Swipe to dismiss</p>
                </div>
              </div>

              <button
                type="button"
                onClick={dismissPromo}
                className="shrink-0 rounded-full bg-white/15 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20"
                aria-label="Dismiss promotion"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
            href="/admin"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2 text-xs font-semibold text-foreground"
          >
            <Building2 className="h-4 w-4" /> Staff Login
          </a>
        </div>

      </div>
    </div>
  );
}
