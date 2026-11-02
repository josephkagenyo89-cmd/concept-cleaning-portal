import { Link, NavLink, Outlet } from 'react-router-dom';
import { Home, LayoutGrid, Sparkles } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

const NAV = [
  { to: '/marketplace', label: 'Home', icon: Home, end: true },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
];

export default function MarketplaceLayout() {
  const { settings } = useSettings();
  const company = settings.general.company_name || 'Concept Cleaning Services';

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#292824]">
      <header className="sticky top-0 z-40 border-b border-[#E9E5DC] bg-white/95 shadow-[0_4px_20px_rgba(41,40,36,0.04)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 md:px-8">
          <Link to="/marketplace" className="flex min-w-0 items-center gap-3" aria-label={`${company} marketplace home`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#292824] text-[#D5B779]">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block max-w-[210px] truncate text-sm font-extrabold leading-tight tracking-tight text-[#292824] sm:text-base">{company}</span>
              <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.22em] text-[#9A7A43]">Services marketplace</span>
            </span>
          </Link>

          <nav aria-label="Marketplace navigation" className="flex shrink-0 items-center gap-1 sm:gap-2">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-xs font-bold transition-colors sm:px-5 sm:text-sm ${
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
      </header>

      <main className="mx-auto max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
}
