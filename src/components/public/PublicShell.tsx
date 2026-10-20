import { ReactNode, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, CalendarCheck, Phone, MessageCircle, Mail, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import conceptLogo from '@/assets/concept-cleaning-logo.png';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/marketplace', label: 'Services & Prices' },
  { to: '/blog', label: 'Blog' },
  { to: '/#areas', label: 'Areas' },
  { to: '/#faq', label: 'FAQ' },
];

export function waLink(phone: string, msg: string) {
  const p = (phone || '+254796563741').replace(/[^0-9]/g, '');
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

export default function PublicShell({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const company = settings.general.company_name || 'Concept Cleaning Services';
  const phone = settings.general.phone || '+254796563741';
  const email = settings.general.email || 'info.conceptcleaningkenya@gmail.com';

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink pb-16 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-brand-sand bg-brand-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-3 min-w-0" aria-label={company}>
            {settings.general.logo_url ? (
              <img src={settings.general.logo_url} alt={`${company} logo`} className="h-12 w-12 rounded-lg object-contain md:h-14 md:w-14" />
            ) : (
              <img src={conceptLogo} alt={`${company} logo`} className="h-12 w-12 rounded-lg object-contain md:h-14 md:w-14 bg-white/0" />
            )}
            <span className="truncate text-base font-bold leading-tight text-brand-forest md:text-xl">{company}</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cn('text-sm font-medium text-brand-slate hover:text-brand-forest', isActive && !n.to.includes('#') && 'text-brand-forest')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm"><Link to="/customer-auth">Customer Login</Link></Button>
            <Button asChild size="sm" className="bg-brand-forest text-brand-cream hover:bg-brand-panel"><Link to="/marketplace">Book Now</Link></Button>
          </div>
          <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-brand-sand bg-brand-paper px-4 py-3 md:hidden" aria-label="Mobile">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block py-2.5 text-base font-medium text-brand-ink">{n.label}</Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button asChild variant="outline"><Link to="/customer-auth">Customer Login</Link></Button>
              <Button asChild variant="outline"><a href="/admin">Staff Login</a></Button>
            </div>
          </nav>
        )}
      </header>

      <main>{children}</main>

      <footer className="mt-16 bg-brand-forest text-brand-cream">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4 md:px-6">
          <div className="md:col-span-2">
            <p className="text-lg font-bold">{company}</p>
            <p className="mt-2 max-w-md text-sm text-brand-mist">Professional residential, commercial, carpet, upholstery and fumigation services across Nairobi and surrounding areas.</p>
          </div>
          <div>
            <p className="font-semibold">Explore</p>
            <ul className="mt-3 space-y-2 text-sm text-brand-mist">
              <li><Link to="/marketplace">Services & Prices</Link></li>
              <li><Link to="/blog">Cleaning Blog</Link></li>
              <li><Link to="/privacy-policy">Privacy Policy</Link></li>
              <li><Link to="/terms-and-conditions">Terms</Link></li>
              <li><a href="/admin">Staff Login</a></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Contact</p>
            <ul className="mt-3 space-y-2 text-sm text-brand-mist">
              <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0" /><a href={`tel:${phone}`}>{phone}</a></li>
              <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0" /><a href={`mailto:${email}`} className="break-all">{email}</a></li>
              <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0" />{settings.general.address || 'Nairobi, Kenya'}</li>
            </ul>
          </div>
        </div>
        <p className="border-t border-brand-line py-4 text-center text-xs text-brand-mist">© {new Date().getFullYear()} {company}. All rights reserved.</p>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-brand-sand bg-brand-paper text-brand-slate md:hidden">
        <a href={`tel:${phone}`} className="flex flex-col items-center py-2 text-xs font-medium"><Phone className="h-5 w-5" />Call</a>
        <a href={waLink(phone, 'Hello Concept Cleaning Services, I would like a quote.')} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center py-2 text-xs font-medium"><MessageCircle className="h-5 w-5" />WhatsApp</a>
        <Link to="/marketplace" className="flex flex-col items-center bg-brand-forest py-2 text-xs font-semibold text-brand-cream"><CalendarCheck className="h-5 w-5" />Book Now</Link>
      </div>
    </div>
  );
}
