import { Link } from "react-router-dom";
import { Phone, MapPin, Mail, Clock, Facebook, Instagram } from "lucide-react";

const Footer = () => (
  <footer className="bg-navy-deep text-white/70 relative overflow-hidden">
    <div className="absolute top-0 left-0 right-0 gold-divider" />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-gold/30 flex items-center justify-center">
              <span className="font-display text-gold text-lg font-bold">C</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-base text-white">Concept</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-gold/80">Cleaning Co.</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-white/50">
            Nairobi's premium cleaning specialists. Homes, offices and vehicles — spotless, every time.
          </p>
          <div className="flex items-center gap-3 mt-5">
            <a href="#" aria-label="Facebook" className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center hover:bg-gold hover:border-gold hover:text-primary transition-all">
              <Facebook className="w-4 h-4" />
            </a>
            <a href="#" aria-label="Instagram" className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center hover:bg-gold hover:border-gold hover:text-primary transition-all">
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="font-display font-semibold text-white mb-5 text-sm tracking-wide">Services</h4>
          <ul className="space-y-2.5 text-sm">
            {["Sofa Cleaning", "Carpet Cleaning", "Residential Cleaning", "Office Cleaning", "Car Detailing", "Pest Management"].map((s) => (
              <li key={s}>
                <Link to="/services" className="hover:text-gold transition-colors">{s}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold text-white mb-5 text-sm tracking-wide">Company</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/about" className="hover:text-gold transition-colors">About Us</Link></li>
            <li><Link to="/portfolio" className="hover:text-gold transition-colors">Gallery</Link></li>
            <li><Link to="/pricing" className="hover:text-gold transition-colors">Pricing</Link></li>
            <li><Link to="/blog" className="hover:text-gold transition-colors">Blog</Link></li>
            <li><Link to="/booking" className="hover:text-gold transition-colors">Book Now</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold text-white mb-5 text-sm tracking-wide">Get in Touch</h4>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-gold mt-0.5 shrink-0" />
              <a href="tel:+254796563741" className="hover:text-gold transition-colors">+254 796 563 741</a>
            </li>
            <li className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-gold mt-0.5 shrink-0" />
              <a href="mailto:info@conceptcleaning.co.ke" className="hover:text-gold transition-colors">info@conceptcleaning.co.ke</a>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gold mt-0.5 shrink-0" />
              <span>Nairobi, Kenya</span>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-gold mt-0.5 shrink-0" />
              <span>Mon – Sat · 7:00 – 19:00</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
        <p>© {new Date().getFullYear()} Concept Cleaning Services. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-gold transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-gold transition-colors">Terms & Conditions</a>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
