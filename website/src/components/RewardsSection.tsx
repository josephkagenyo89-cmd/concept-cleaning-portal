import { Link } from "react-router-dom";
import { Gift, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { REWARD_TIERS } from "@/lib/rewards";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.5 },
  }),
};

const tierColors = [
  "border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20",
  "border-slate-300/60 bg-slate-50/60 dark:bg-slate-900/20",
  "border-primary/30 bg-primary/5",
];

const RewardsSection = () => (
  <section className="section-padding bg-gradient-to-b from-accent/30 to-background">
    <div className="max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
          <Gift className="w-3.5 h-3.5" /> Limited Time Offer
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold mb-3">
          Get FREE Cleaning Products with Every Service 🎁
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Book services above KES 7,000 and receive premium cleaning detergents at no extra cost.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        {[...REWARD_TIERS].reverse().map((tier, i) => (
          <motion.div
            key={tier.label}
            custom={i}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className={`rounded-2xl border-2 p-6 transition-shadow hover:shadow-lg ${tierColors[i]}`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{tier.label}</span>
              <span className="text-sm font-bold text-primary">KES {tier.minAmount.toLocaleString()}+</span>
            </div>
            <ul className="space-y-2.5">
              {tier.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Gift className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center">
        <p className="text-muted-foreground text-sm mb-5">Upgrade your service and unlock more FREE rewards</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link to="/booking">Book Now & Get Free Products <ArrowRight className="w-4 h-4 ml-2" /></Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/pricing">View Packages</Link>
          </Button>
        </div>
      </motion.div>
    </div>
  </section>
);

export default RewardsSection;
