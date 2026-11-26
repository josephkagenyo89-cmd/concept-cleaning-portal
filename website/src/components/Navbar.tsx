import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";


const navLinks = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/portfolio", label: "Gallery" },
  { to: "/blog", label: "Blog" },
  { to: "/contact", label: "Contact" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user } = useAuth();


  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "glass shadow-card" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center relative overflow-hidden">
              <span className="font-display text-gold text-lg font-bold">C</span>
              <span className="absolute inset-0 rounded-full ring-1 ring-gold/40" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-[15px] text-primary tracking-tight">Concept</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Cleaning Co.</span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? "text-primary"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {link.label}
                {location.pathname === link.to && (
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-1 w-1 h-1 rounded-full bg-gold" />
                )}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-2">
            {user ? (
              <Button asChild variant="outline" size="default" className="rounded-full">
                <Link to="/portal"><User className="w-4 h-4 mr-1.5" /> My Portal</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="default" className="rounded-full">
                <Link to="/auth?mode=signup">Join the Family</Link>
              </Button>
            )}
            <Button asChild size="default">
              <Link to="/booking">Book Now</Link>
            </Button>
          </div>


          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-full hover:bg-muted text-primary"
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden glass border-t border-border/50">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-3 rounded-2xl text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? "bg-primary/5 text-primary"
                    : "text-muted-foreground hover:text-primary hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 space-y-2">
              {user ? (
                <Button asChild variant="outline" className="w-full rounded-full">
                  <Link to="/portal" onClick={() => setIsOpen(false)}><User className="w-4 h-4 mr-1.5" />My Portal</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" className="w-full rounded-full">
                  <Link to="/auth?mode=signup" onClick={() => setIsOpen(false)}>Join the Family</Link>
                </Button>
              )}
              <Button asChild className="w-full">
                <Link to="/booking" onClick={() => setIsOpen(false)}>Book Now</Link>
              </Button>
            </div>

          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
