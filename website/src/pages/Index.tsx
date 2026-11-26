import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Shield, Award, Leaf, Clock, MessageCircle, Star, CheckCircle2, Sparkles, Users, Wrench, Heart, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { motion, useInView } from "framer-motion";
import heroImage from "@/assets/hero-luxury.jpg";
import { whatsappLink } from "@/lib/whatsapp";
import RewardsSection from "@/components/RewardsSection";
import AreasWeServe from "@/components/AreasWeServe";
import PageHead from "@/components/PageHead";
import BlogCard from "@/components/BlogCard";

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] as const },
  }),
};

const formatPrice = (s: any) => {
  if (s.price_type === "custom") return "Get Quote";
  if (s.price_type === "per_unit") return `KES ${Number(s.price_value).toLocaleString()}/${s.pricing_unit || "unit"}`;
  return `From KES ${Number(s.price_value).toLocaleString()}`;
};

const trustBadges = [
  { icon: Star, label: "5.0 Rated" },
  { icon: Wrench, label: "Pro Equipment" },
  { icon: Shield, label: "Fully Insured" },
  { icon: Leaf, label: "Eco-Friendly" },
  { icon: Clock, label: "Same-Day Service" },
];

const whyChoose = [
  { icon: Award, title: "Certified Professionals", desc: "Trained, vetted and background-checked specialists." },
  { icon: Sparkles, title: "Affordable Premium Service", desc: "Luxury-level results at fair, transparent prices." },
  { icon: Wrench, title: "Modern Equipment", desc: "Commercial-grade extractors, steamers and detailing kit." },
  { icon: Leaf, title: "Eco-Friendly Products", desc: "Non-toxic, family and pet-safe cleaning solutions." },
  { icon: Users, title: "Reliable Team", desc: "Uniformed crews, on-time arrivals, consistent quality." },
  { icon: Heart, title: "100% Satisfaction Guarantee", desc: "We re-clean free of charge until you're delighted." },
];

const stats = [
  { value: 2000, suffix: "+", label: "Happy Clients" },
  { value: 5000, suffix: "+", label: "Jobs Completed" },
  { value: 98, suffix: "%", label: "Satisfaction Rate" },
  { value: 24, suffix: "/7", label: "Support Available" },
];

const testimonials = [
  { name: "Amina W.", role: "Kilimani, Nairobi", quote: "Impeccable service. My sofas look brand new. The team was punctual, uniformed and incredibly detailed.", rating: 5 },
  { name: "Daniel M.", role: "Runda", quote: "By far the most professional cleaning company I've worked with in Nairobi. Worth every shilling.", rating: 5 },
  { name: "Grace O.", role: "Karen", quote: "They transformed our office overnight. Reliable, discreet and premium end-to-end.", rating: 5 },
];

const AnimatedCounter = ({ value, suffix }: { value: number; suffix: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 1600;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
};

const Index = () => {
  const [recentWork, setRecentWork] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [latestPosts, setLatestPosts] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("portfolio_posts").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(6),
      supabase.from("services").select("*, service_categories(name)").eq("is_active", true).order("name").limit(6),
      supabase.from("blog_posts").select("*").eq("is_published", true).order("published_at", { ascending: false }).limit(3),
    ]).then(([work, svc, blog]) => {
      setRecentWork(work.data ?? []);
      setServices((svc.data ?? []).map((s: any) => ({ ...s, category: s.service_categories?.name?.trim() ?? "Other", price_value: Number(s.base_price ?? 0), price_type: s.pricing_model === "variation" ? "range" : s.pricing_model === "per_unit" && s.pricing_unit === "sqm" ? "per_sqm" : s.pricing_model })));
      setLatestPosts(blog.data ?? []);
    });
  }, []);

  return (
    <div>
      <PageHead
        title="Premium Cleaning Services Nairobi | Homes, Offices & Cars — Concept"
        description="Nairobi's premium cleaning company. Sofa, carpet, mattress, office & residential cleaning, pest management and interior car detailing across Nairobi, Kiambu, Machakos & Kajiado."
        keywords="premium cleaning services Nairobi, luxury cleaning Nairobi, sofa cleaning Nairobi, carpet cleaning Nairobi, office cleaning Nairobi, car detailing Nairobi, Kiambu, Machakos, Kajiado"
        canonical="https://concept-cleaning-kenya.lovable.app"
      />

      {/* HERO */}
      <section className="relative min-h-[100svh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Professional cleaners working inside a luxury modern Nairobi home"
            className="w-full h-full object-cover"
            width={1920}
            height={1280}
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-navy-deep/95 via-navy-deep/80 to-navy/70" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--gold)/0.18),transparent_55%)]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/8 border border-gold/30 text-gold text-[11px] font-medium tracking-[0.18em] uppercase mb-8 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" /> Nairobi's Premium Cleaning Company
            </div>

            <h1 className="font-display text-white text-[42px] sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6">
              Premium Cleaning for<br />
              <span className="text-gold italic font-medium">Homes, Offices</span> &<br />
              Vehicles.
            </h1>

            <p className="text-white/75 text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl font-light">
              Professional sofa, mattress, carpet, office and residential cleaning, pest management and interior car detailing — across Nairobi, Kiambu, Machakos and Kajiado.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <Button asChild size="xl" variant="gold">
                <Link to="/booking">Book a Service <ArrowRight className="w-4 h-4" /></Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="border-white/30 text-white hover:bg-white hover:text-primary">
                <Link to="/contact">Get Free Quote</Link>
              </Button>
              <Button asChild size="xl" variant="emerald">
                <a href={whatsappLink("Hello, I would like a free cleaning quote.")} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
              </Button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex text-gold">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-gold" />)}
              </div>
              <span className="text-white/70 text-sm">Rated 5.0 by happy clients</span>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {trustBadges.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-white/70 text-sm">
                  <b.icon className="w-4 h-4 text-gold" />
                  {b.label}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 gold-divider" />
      </section>

      {/* SERVICES */}
      <section className="section-padding bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
            <div className="max-w-xl">
              <p className="text-gold text-xs font-semibold tracking-[0.24em] uppercase mb-4">Our Services</p>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground">A complete cleaning suite.</h2>
            </div>
            <Link to="/services" className="hidden sm:inline-flex items-center gap-2 text-primary font-medium text-sm hover:text-gold transition-colors">
              View all services <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, i) => (
              <motion.div
                key={service.id}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={fadeUp}
                className="group p-8 rounded-3xl bg-card border border-border/60 hover-lift flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-display font-semibold text-xl text-foreground">{service.name}</h3>
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-gold-dark bg-gold/10 px-3 py-1 rounded-full whitespace-nowrap">
                    {formatPrice(service)}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6 line-clamp-3 flex-1">{service.description}</p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link to={`/services/${service.slug}`}>Learn More</Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1">
                    <Link to={`/booking?service=${encodeURIComponent(service.name)}`}>Book</Link>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="section-padding bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-gold text-xs font-semibold tracking-[0.24em] uppercase mb-4">Why Choose Concept</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-5">Why Nairobi chooses Concept Cleaning Services.</h2>
            <p className="text-muted-foreground text-lg">From sofa, carpet and deep cleaning to car detailing, our trained team serves homes and businesses across Nairobi, Kiambu, Kajiado and Machakos.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyChoose.map((item, i) => (
              <motion.div
                key={item.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
                variants={fadeUp}
                className="group p-8 rounded-3xl bg-card border border-border/60 hover-lift"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:border-primary transition-colors">
                  <item.icon className="w-6 h-6 text-primary group-hover:text-gold transition-colors" />
                </div>
                <h3 className="font-display font-semibold text-xl text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative py-24 sm:py-32 bg-navy text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--gold)/0.15),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-gold text-xs font-semibold tracking-[0.24em] uppercase mb-4">By The Numbers</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-white">Trusted across Nairobi.</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-5xl sm:text-6xl font-bold text-gold mb-2 tabular-nums">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </div>
                <p className="text-white/60 text-sm uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY / BEFORE-AFTER */}
      {recentWork.length > 0 && (
        <section className="section-padding bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
              <div className="max-w-xl">
                <p className="text-gold text-xs font-semibold tracking-[0.24em] uppercase mb-4">Before & After</p>
                <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground">Real transformations.</h2>
              </div>
              <Link to="/portfolio" className="hidden sm:inline-flex items-center gap-2 text-primary font-medium text-sm hover:text-gold transition-colors">
                Open full gallery <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentWork.slice(0, 6).map((item, i) => (
                <motion.div
                  key={item.id}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-80px" }}
                  variants={fadeUp}
                  className="group rounded-3xl overflow-hidden bg-card border border-border/60 hover-lift"
                >
                  <div className="grid grid-cols-2 aspect-[3/2] relative">
                    <div className="relative overflow-hidden">
                      {item.before_image_url ? (
                        <img src={item.before_image_url} alt={`Before ${item.title}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                      ) : <div className="w-full h-full bg-muted" />}
                      <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-wider uppercase bg-white/90 text-primary px-2.5 py-1 rounded-full">Before</span>
                    </div>
                    <div className="relative overflow-hidden">
                      {item.after_image_url ? (
                        <img src={item.after_image_url} alt={`After ${item.title}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                      ) : <div className="w-full h-full bg-muted" />}
                      <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-wider uppercase bg-gold text-primary px-2.5 py-1 rounded-full">After</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-display font-semibold text-base text-foreground">{item.title}</h3>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.category}</span>
                    </div>
                    <p className="text-muted-foreground text-sm line-clamp-1">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TESTIMONIALS */}
      <section className="section-padding bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-gold text-xs font-semibold tracking-[0.24em] uppercase mb-4">Client Testimonials</p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground">Words from our clients.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.figure
                key={t.name}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="p-8 rounded-3xl bg-card border border-border/60 hover-lift flex flex-col"
              >
                <div className="flex text-gold mb-5">
                  {[...Array(t.rating)].map((_, k) => <Star key={k} className="w-4 h-4 fill-gold" />)}
                </div>
                <blockquote className="font-display text-lg leading-relaxed text-foreground mb-6 flex-1">
                  "{t.quote}"
                </blockquote>
                <figcaption className="flex items-center gap-3 pt-5 border-t border-border/60">
                  <div className="w-11 h-11 rounded-full bg-primary text-gold font-display font-bold flex items-center justify-center">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role} · Google Review</div>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* AREAS */}
      <AreasWeServe />

      {/* REWARDS / OFFERS */}
      <RewardsSection />

      {/* BLOG */}
      {latestPosts.length > 0 && (
        <section className="section-padding bg-background">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
              <div className="max-w-xl">
                <p className="text-gold text-xs font-semibold tracking-[0.24em] uppercase mb-4">Journal</p>
                <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground">Latest insights.</h2>
              </div>
              <Link to="/blog" className="hidden sm:inline-flex items-center gap-2 text-primary font-medium text-sm hover:text-gold transition-colors">
                Read all articles <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestPosts.map((p) => <BlogCard key={p.id} post={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="relative py-24 sm:py-32 bg-navy-deep text-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--gold)/0.18),transparent_60%)]" />
        <div className="relative max-w-3xl mx-auto text-center px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/30 text-gold text-[11px] font-medium tracking-[0.18em] uppercase mb-8">
            <ThumbsUp className="w-3.5 h-3.5" /> Same-Day Booking Available
          </div>
          <h2 className="font-display text-4xl sm:text-6xl font-bold mb-6 leading-tight">
            Ready for a spotless<br />
            <span className="text-gold italic font-medium">home or office?</span>
          </h2>
          <p className="text-white/70 mb-10 text-lg max-w-xl mx-auto">
            Book in under a minute. Our team will confirm your appointment on WhatsApp within the hour.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="xl" variant="gold">
              <Link to="/booking">Book Now <ArrowRight className="w-4 h-4" /></Link>
            </Button>
            <Button asChild size="xl" variant="emerald">
              <a href={whatsappLink("Hello, I would like to book a cleaning service")} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" /> WhatsApp Us
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
