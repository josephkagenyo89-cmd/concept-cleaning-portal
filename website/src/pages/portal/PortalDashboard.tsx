import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Calendar,
  FileText,
  Gift,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Star,
  MessageCircle,
  Repeat,
  Download,
  Check,
  Clock,
  MapPin,
  User,
  ChevronRight,
  BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink } from "@/lib/whatsapp";

/* ---------- helpers ---------- */

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good Morning", emoji: "☀️" };
  if (h < 17) return { text: "Good Afternoon", emoji: "👋" };
  return { text: "Good Evening", emoji: "🌙" };
};

const tierMap = {
  Silver: { next: "Gold", threshold: 20000, benefits: ["Online booking", "Member offers", "Booking history"] },
  Gold: { next: "Platinum", threshold: 75000, benefits: ["Priority booking", "Exclusive discounts", "Birthday voucher"] },
  Platinum: { next: null as string | null, threshold: Infinity, benefits: ["VIP discounts", "Free annual inspection", "Dedicated support"] },
} as const;

const Counter = ({ to, prefix = "", format = (v: number) => Math.round(v).toLocaleString() }: { to: number; prefix?: string; format?: (v: number) => string }) => {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => `${prefix}${format(v)}`);
  useEffect(() => {
    const controls = animate(mv, to, { duration: 1.2, ease: "easeOut" });
    return controls.stop;
  }, [to, mv]);
  return <motion.span>{display}</motion.span>;
};

/* ---------- page ---------- */

const PortalDashboard = () => {
  const { user, profile } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data: clients } = await supabase.from("clients").select("id").eq("user_id", user.id);
      const clientIds = (clients ?? []).map((c) => c.id);
      if (clientIds.length === 0) {
        setBookings([]); setInvoices([]); setLoading(false); return;
      }
      const [b, i] = await Promise.all([
        supabase.from("bookings").select("*, services(name)").in("client_id", clientIds).order("service_date", { ascending: false }).limit(10),
        supabase.from("invoices").select("*").in("client_id", clientIds).order("created_at", { ascending: false }).limit(5),
      ]);
      setBookings(b.data ?? []);
      setInvoices(i.data ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  const g = greeting();
  const firstName = (profile?.full_name ?? user?.email ?? "").split(" ")[0] || "Member";
  const tier = (profile?.membership_tier as keyof typeof tierMap) ?? "Silver";
  const tierInfo = tierMap[tier] ?? tierMap.Silver;
  const spend = Number(profile?.lifetime_spend ?? 0);
  const remaining = tierInfo.next ? Math.max(0, tierInfo.threshold - spend) : 0;
  const pct = tierInfo.next ? Math.min(100, (spend / tierInfo.threshold) * 100) : 100;

  const upcoming = bookings.filter((b) => !["completed","cancelled"].includes(String(b.status).toLowerCase()));
  const lastBooking = bookings[0];
  const lastInvoice = invoices[0];

  /* profile completion */
  const fields = [
    ["full_name", "Full name"], ["phone", "Phone number"], ["address", "Address"], ["county", "County"],
  ] as const;
  const missing = fields.filter(([k]) => !(profile as any)?.[k]);
  const completion = Math.round(((fields.length - missing.length) / fields.length) * 100);

  /* timeline */
  const timeline = useMemo(() => {
    const items: { label: string; date?: string; icon: any; done: boolean }[] = [
      { label: "Account created", date: user?.created_at?.slice(0, 10), icon: Sparkles, done: true },
      { label: "First booking placed", date: bookings.at(-1)?.service_date, icon: Calendar, done: bookings.length > 0 },
      { label: "Last cleaning completed", date: bookings.find((b) => String(b.status).toLowerCase() === "completed")?.service_date, icon: Check, done: bookings.some((b) => String(b.status).toLowerCase() === "completed") },
      { label: "Last invoice issued", date: lastInvoice?.created_at?.slice(0, 10), icon: FileText, done: !!lastInvoice },
      { label: "Reward earned", date: (profile?.loyalty_points ?? 0) > 0 ? "In wallet" : undefined, icon: Gift, done: (profile?.loyalty_points ?? 0) > 0 },
    ];
    return items;
  }, [bookings, lastInvoice, profile, user]);

  /* reminders */
  const reminders = useMemo(() => {
    const r: string[] = [];
    const lastCompleted = bookings.find((b) => String(b.status).toLowerCase() === "completed");
    if (!lastCompleted) r.push("Book your first professional cleaning to start your service history.");
    else r.push(`It’s been a while since ${lastCompleted.services?.name ?? "your last service"}. Consider a refresh.`);
    if (missing.length) r.push(`Keep your contact details up to date so our team can serve you better.`);
    r.push("Annual pest inspection is recommended for premium homes.");
    return r.slice(0, 3);
  }, [bookings, missing]);

  return (
    <div className="space-y-8">
      {/* ================= Welcome ================= */}
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground p-7 sm:p-10 shadow-card"
      >
        <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-gold/25 blur-3xl" />
        <div className="absolute -left-20 -bottom-24 w-72 h-72 rounded-full bg-emerald/20 blur-3xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.25em] text-gold/90 mb-3">Concept Concierge</p>
          <h1 className="font-display text-3xl sm:text-5xl font-bold leading-tight">
            {g.text}, {firstName} <span className="inline-block">{g.emoji}</span>
          </h1>
          <p className="mt-3 text-lg sm:text-xl text-primary-foreground/85 font-medium">
            Welcome to your Premium Cleaning Concierge.
          </p>
          <p className="mt-2 text-primary-foreground/65 max-w-xl">
            Manage your bookings, documents, rewards and home care from one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="gold" size="lg" asChild>
              <Link to="/booking">Book a Service <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
            <Button variant="outline" size="lg" className="border-white/25 bg-white/5 text-primary-foreground hover:bg-white/15" asChild>
              <Link to="/services">Explore Services</Link>
            </Button>
          </div>
        </div>
      </motion.section>

      {/* ================= Quick Actions ================= */}
      <section>
        <SectionHeading title="Quick Actions" subtitle="Everything you need, one tap away" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <QuickAction icon={Calendar} label="Book a Service" to="/booking" />
          <QuickAction icon={Repeat} label="Book Again" to={lastBooking ? `/booking?service=${encodeURIComponent(lastBooking.services?.name ?? "")}` : "/booking"} />
          <QuickAction icon={Download} label="Last Invoice" to="/portal/documents" />
          <QuickAction icon={MessageCircle} label="WhatsApp Support" href={whatsappLink(`Hello, this is ${firstName} from my member portal.`)} accent="emerald" />
          <QuickAction icon={Star} label="Leave a Review" href="https://g.page/r/" accent="gold" />
          <QuickAction icon={Gift} label="Redeem Rewards" to="/portal/rewards" accent="gold" />
        </div>
      </section>

      {/* ================= Membership + Profile completion ================= */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Membership */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2 relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-cream via-background to-cream p-6 sm:p-7 shadow-soft"
        >
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-gold/15 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-glow">
              <Sparkles className="w-9 h-9 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Membership</p>
              <p className="font-display text-3xl font-bold text-primary">{tier} Member</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tierInfo.benefits.map((b) => (
                  <span key={b} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/5 text-primary border border-primary/10">{b}</span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Loyalty Points</p>
              <p className="font-display text-3xl font-bold text-gold">
                <Counter to={profile?.loyalty_points ?? 0} />
              </p>
            </div>
          </div>

          {tierInfo.next && (
            <div className="relative mt-6">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-primary">Progress to {tierInfo.next}</span>
                <span className="text-muted-foreground">KES {spend.toLocaleString()} / {tierInfo.threshold.toLocaleString()}</span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary via-gold to-gold rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Spend <span className="text-primary font-semibold">KES {remaining.toLocaleString()}</span> more to unlock <span className="text-gold font-semibold">{tierInfo.next} Membership</span>.
              </p>
            </div>
          )}

          <div className="relative mt-5">
            <Button variant="outline" asChild className="border-primary/20">
              <Link to="/portal/rewards">View Benefits <ChevronRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
        </motion.div>

        {/* Profile completion */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-3xl border border-border bg-card p-6 shadow-soft"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Profile Completion</p>
          <div className="mt-3 flex items-center gap-4">
            <ProgressRing pct={completion} />
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold text-primary"><Counter to={completion} format={(v) => `${Math.round(v)}%`} /></p>
              <p className="text-xs text-muted-foreground">Complete to earn 200 points</p>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5">
            {missing.slice(0, 4).map(([k, label]) => (
              <li key={k} className="text-sm text-muted-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold" /> {label}
              </li>
            ))}
            {missing.length === 0 && <li className="text-sm text-emerald flex items-center gap-2"><Check className="w-4 h-4" /> All set — enjoy your perks.</li>}
          </ul>
          <Button size="sm" className="mt-4 w-full" asChild><Link to="/portal/profile">Complete Profile</Link></Button>
        </motion.div>
      </section>

      {/* ================= Customer Summary ================= */}
      <section>
        <SectionHeading title="Your Concept Summary" subtitle="A snapshot of your journey with us" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Total Bookings" value={profile?.total_bookings ?? bookings.length} icon={Calendar} />
          <StatTile label="Lifetime Spend" value={spend} icon={TrendingUp} prefix="KES " />
          <StatTile label="Loyalty Points" value={profile?.loyalty_points ?? 0} icon={Gift} accent />
          <StatTile label="Referrals" value={0} icon={Users} />
          <StatTile label="Money Saved" value={Math.round(spend * 0.08)} icon={Wallet} prefix="KES " accent />
          <StatTile label="Reviews" value={0} icon={Star} />
        </div>
      </section>

      {/* ================= Upcoming Bookings ================= */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionHeading title="Upcoming Bookings" subtitle="Your next visits from our concierge team" inline />
          <Link to="/portal/bookings" className="text-xs text-muted-foreground hover:text-primary">View all →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {loading && Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-muted/50 animate-pulse" />
          ))}
          {!loading && upcoming.length === 0 && (
            <div className="md:col-span-2 rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground mb-3">No upcoming bookings yet.</p>
              <Button asChild><Link to="/booking">Book Your First Service</Link></Button>
            </div>
          )}
          {!loading && upcoming.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="group rounded-2xl border border-border bg-card p-5 shadow-soft hover:shadow-card transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-primary truncate">{b.services?.name ?? "Cleaning service"}</p>
                  <p className="text-xs text-muted-foreground">#{b.booking_code ?? b.id.slice(0, 8)}</p>
                </div>
                <StatusPill status={b.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {b.service_date}</span>
                {b.service_time && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {b.service_time}</span>}
                {b.location && <span className="flex items-center gap-1.5 col-span-2 truncate"><MapPin className="w-3.5 h-3.5" /> {b.location}</span>}
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Technician TBA</span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" asChild className="flex-1"><Link to="/portal/bookings">View</Link></Button>
                <Button size="sm" variant="outline" asChild className="flex-1"><a href={whatsappLink(`Hi, I'd like to reschedule booking ${b.booking_code ?? b.id.slice(0, 8)}.`)} target="_blank" rel="noopener noreferrer">Reschedule</a></Button>
                <Button size="sm" asChild className="flex-1"><Link to={`/booking?service=${encodeURIComponent(b.services?.name ?? "")}`}>Book Again</Link></Button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ================= Timeline + Reminders ================= */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <SectionHeading title="Your Journey" subtitle="Milestones with Concept Cleaning Services" inline />
          <ol className="mt-5 relative border-l border-border ml-3 space-y-5">
            {timeline.map((t, idx) => {
              const Icon = t.icon;
              return (
                <li key={idx} className="pl-6 relative">
                  <span className={`absolute -left-[13px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-background ${t.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="w-3 h-3" />
                  </span>
                  <p className={`text-sm font-medium ${t.done ? "text-primary" : "text-muted-foreground"}`}>{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.date ?? "—"}</p>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-3xl border border-gold/30 bg-gradient-to-br from-cream to-background p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <BellRing className="w-4 h-4 text-gold" />
            <p className="text-xs uppercase tracking-[0.2em] text-gold-foreground/80">Smart Reminders</p>
          </div>
          <p className="font-display text-lg font-semibold text-primary">Care suggestions for you</p>
          <ul className="mt-4 space-y-3">
            {reminders.map((r, i) => (
              <li key={i} className="rounded-xl bg-card border border-border p-3 text-sm text-primary flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-gold mt-0.5 shrink-0" />
                <span className="flex-1">{r}</span>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" asChild className="mt-4 w-full border-primary/20"><Link to="/booking">Book from Reminder</Link></Button>
        </div>
      </section>

      {/* ================= Last invoice inline ================= */}
      {lastInvoice && (
        <section className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between gap-3 shadow-soft">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Latest Invoice</p>
            <p className="font-display text-lg font-semibold text-primary truncate">{lastInvoice.invoice_number} · {lastInvoice.service}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-primary">KES {Number(lastInvoice.amount).toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground">{lastInvoice.status}</p>
          </div>
          <Button size="sm" variant="outline" asChild><Link to="/portal/documents"><Download className="w-4 h-4 mr-1" /> Download</Link></Button>
        </section>
      )}
    </div>
  );
};

/* ---------- sub components ---------- */

const SectionHeading = ({ title, subtitle, inline }: { title: string; subtitle?: string; inline?: boolean }) => (
  <div className={inline ? "" : "mb-3"}>
    <h2 className="font-display text-xl font-semibold text-primary">{title}</h2>
    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
  </div>
);

const QuickAction = ({ icon: Icon, label, to, href, accent }: { icon: any; label: string; to?: string; href?: string; accent?: "gold" | "emerald" }) => {
  const inner = (
    <motion.div
      whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
      className="group h-full rounded-2xl border border-border bg-card p-4 flex flex-col items-start gap-3 shadow-soft hover:shadow-card transition"
    >
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        accent === "emerald" ? "bg-emerald/10 text-emerald" :
        accent === "gold" ? "bg-gold/15 text-gold" :
        "bg-primary/5 text-primary"
      }`}>
        <Icon className="w-5 h-5" />
      </span>
      <div>
        <p className="text-sm font-medium text-primary leading-tight">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 group-hover:text-primary transition">Tap to open →</p>
      </div>
    </motion.div>
  );
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  return <Link to={to!}>{inner}</Link>;
};

const StatTile = ({ label, value, icon: Icon, prefix, accent }: { label: string; value: number; icon: any; prefix?: string; accent?: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border border-border bg-card p-4 shadow-soft"
  >
    <div className="flex items-center justify-between mb-2">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <Icon className={`w-4 h-4 ${accent ? "text-gold" : "text-primary"}`} />
    </div>
    <p className="font-display text-xl font-bold text-primary truncate">
      <Counter to={Number(value) || 0} prefix={prefix} />
    </p>
  </motion.div>
);

const StatusPill = ({ status }: { status: string }) => {
  const cls =
    status === "Approved" ? "bg-emerald/10 text-emerald border-emerald/20" :
    status === "Completed" ? "bg-primary/5 text-primary border-primary/10" :
    status === "Cancelled" ? "bg-muted text-muted-foreground border-border" :
    "bg-gold/15 text-gold-foreground border-gold/30";
  return <span className={`text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1 rounded-full border ${cls}`}>{status}</span>;
};

const ProgressRing = ({ pct }: { pct: number }) => {
  const r = 26; const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={r} strokeWidth="6" className="stroke-muted" fill="none" />
      <motion.circle
        cx="32" cy="32" r={r} strokeWidth="6" fill="none" strokeLinecap="round"
        className="stroke-primary" transform="rotate(-90 32 32)"
        style={{ strokeDasharray: c }}
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1 }}
      />
    </svg>
  );
};

export default PortalDashboard;
