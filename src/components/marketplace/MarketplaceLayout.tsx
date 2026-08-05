import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, CalendarCheck, MessageCircle, User, Sparkles, Globe, LogIn, Building2 } from 'lucide-react';
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

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
];

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
  { to: '/my/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/my/messages', label: 'Messages', icon: MessageCircle },
  { to: '/my/account', label: 'Profile', icon: User },
];

export default function MarketplaceLayout() {
  const { settings } = useSettings();
  const { user, isCustomer, customerClient } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [lang, setLang] = useState(() => localStorage.getItem('ccs_market_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('ccs_market_lang', lang);
  }, [lang]);

  const company = settings.general.company_name || 'Concept Cleaning Services';
  const activeLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-market text-market-foreground shadow-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            {settings.general.logo_url ? (
              <img src={settings.general.logo_url} alt={company} className="h-9 w-9 rounded-lg bg-white/10 object-contain" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Sparkles className="h-5 w-5" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight">{company}</span>
              <span className="block text-[11px] leading-tight opacity-80">Trusted cleaning marketplace</span>
            </span>
          </Link>

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
                onClick={() => navigate('/my/account')}
              >
                <User className="h-4 w-4" />
                <span className="max-w-[80px] truncate text-xs font-medium">
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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl">
        <Outlet />
      </main>

      {/* Bottom navigation + staff login */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card">
        <nav className="mx-auto flex max-w-3xl items-stretch">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-market' : 'text-muted-foreground'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mx-auto max-w-3xl border-t bg-muted/40 px-4 py-2">
          <Link
            to="/login"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2 text-xs font-semibold text-foreground"
          >
            <Building2 className="h-4 w-4" /> Staff Login
          </Link>
        </div>
      </div>
    </div>
  );
}
