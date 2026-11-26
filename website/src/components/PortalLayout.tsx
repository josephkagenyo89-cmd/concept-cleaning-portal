import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, Calendar, FileText, Gift, User, LogOut, Sparkles, Users, Building2, Sofa } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/portal", label: "Dashboard", icon: Home, end: true },
  { to: "/portal/bookings", label: "My Bookings", icon: Calendar },
  { to: "/portal/properties", label: "Properties", icon: Building2 },
  { to: "/portal/assets", label: "Assets", icon: Sofa },
  { to: "/portal/documents", label: "Documents", icon: FileText },
  { to: "/portal/rewards", label: "Rewards", icon: Gift },
  { to: "/portal/refer", label: "Refer & Earn", icon: Users },
  { to: "/portal/profile", label: "Profile", icon: User },
];

const PortalLayout = () => {
  const { user, loading, signOut, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading your portal…</div>;
  }

  const initials = (profile?.full_name ?? user.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-gold" />
            </div>
            <div className="leading-none">
              <p className="font-display font-bold text-sm">Concept</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gold/80">Member Portal</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-primary-foreground/70">{profile?.membership_tier ?? "Silver"} Member</p>
              <p className="text-sm font-medium">{profile?.full_name ?? user.email}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-gold text-primary flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10" onClick={async () => { await signOut(); navigate("/"); }}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <nav className="bg-card border border-border rounded-2xl p-2 flex lg:flex-col gap-1 overflow-x-auto">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-primary hover:bg-muted"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        <main><Outlet /></main>
      </div>
    </div>
  );
};

export default PortalLayout;
