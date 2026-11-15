import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, UserRound } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

import GlobalDiscountBanner from "@/components/marketplace/GlobalDiscountBanner";
const NAV = [
  { to: '/', label: 'Home', mobileLabel: 'Home', icon: ArrowLeft, end: true },
  { to: '/categories', label: 'Categories', mobileLabel: 'Services', icon: LayoutGrid },
  { to: '/my/account', label: 'My Account', mobileLabel: 'Account', icon: UserRound },
];

export default function MarketplaceLayout() {
  const { settings } = useSettings();
  const company = settings.general.company_name || 'Concept Cleaning Services';

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#292824]">
      <header className="sticky top-0 z-40 border-b border-[#E9E5DC] bg-white/95 shadow-[0_4px_20px_rgba(41,40,36,0.04)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 md:px-8">
          <Link to="/marketplace" className="flex min-w-0 items-center gap-3" aria-label={`${company} marketplace home`}>
            <span className="min-w-0">
              <span className="block max-w-[190px] truncate text-sm font-extrabold leading-tight tracking-tight text-[#292824] sm:max-w-[240px] sm:text-base">{company}</span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9A7A43]">Services marketplace</span>
            </span>
          </Link>

          <nav aria-label="Marketplace navigation" className="hidden shrink-0 items-center gap-1 sm:gap-2 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center gap-2 rounded-full px-3 py-2.5 text-xs font-bold transition-colors sm:px-5 sm:text-sm ${
                    isActive
                      ? 'bg-[#292824] text-white shadow-sm'
                      : 'text-[#625F58] hover:bg-[#F3F0E9] hover:text-[#292824]'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <nav aria-label="Mobile marketplace navigation" className="grid grid-cols-3 border-t border-[#E9E5DC] px-2 py-1 md:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-bold transition-colors ${
                  isActive ? 'text-[#292824]' : 'text-[#77736B]'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.mobileLabel}
            </NavLink>
          ))}
        </nav>
      </header>

      <GlobalDiscountBanner />
      <main className="mx-auto max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}
