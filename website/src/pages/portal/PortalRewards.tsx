import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Crown, Award, Check } from "lucide-react";

const tiers = [
  { name: "Silver", threshold: 0, color: "text-muted-foreground", perks: ["Online booking", "Booking history", "Member-only offers"] },
  { name: "Gold", threshold: 20000, color: "text-gold", perks: ["Priority booking", "Exclusive discounts", "Birthday voucher", "Early access to promotions"] },
  { name: "Platinum", threshold: 75000, color: "text-primary", perks: ["Highest priority", "VIP discounts", "Free annual inspection", "Free cleaning product gifts", "Dedicated support"] },
];

const PortalRewards = () => {
  const { profile } = useAuth();
  const current = profile?.membership_tier ?? "Silver";
  const spend = Number(profile?.lifetime_spend ?? 0);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-primary">Rewards & Loyalty</h1>

      <div className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center">
            {current === "Platinum" ? <Crown className="w-8 h-8 text-gold" /> :
             current === "Gold" ? <Award className="w-8 h-8 text-gold" /> :
             <Sparkles className="w-8 h-8 text-gold" />}
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-gold/80">Your Tier</p>
            <p className="font-display text-3xl font-bold">{current}</p>
            <p className="text-sm text-primary-foreground/70">Lifetime spend: KES {spend.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map((t) => {
          const isCurrent = t.name === current;
          return (
            <div key={t.name} className={`rounded-2xl p-5 border ${isCurrent ? "border-gold bg-cream" : "border-border bg-card"}`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`font-display text-xl font-bold ${t.color}`}>{t.name}</p>
                {isCurrent && <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-primary text-primary-foreground">Current</span>}
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {t.threshold === 0 ? "Free membership" : `From KES ${t.threshold.toLocaleString()} lifetime spend`}
              </p>
              <ul className="space-y-1.5">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${isCurrent ? "text-emerald" : "text-muted-foreground"}`} />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PortalRewards;
