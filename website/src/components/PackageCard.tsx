import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Gift, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { getRewardTier } from "@/lib/rewards";
import { whatsappLink } from "@/lib/whatsapp";

interface PackageCardProps {
  service: any;
  discount?: number;
  applyDiscount?: (v: number) => number;
}

const parseIncludedServices = (desc: string): string[] => {
  const match = desc.match(/Includes?:\s*(.*)/i);
  if (!match) return [];
  return match[1].split(/[,;•|]/).map((s) => s.trim()).filter(Boolean);
};

const PackageCard = ({ service, discount = 0, applyDiscount }: PackageCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const price = Number(service.price_value);
  const discountedPrice = applyDiscount ? applyDiscount(price) : price;
  const reward = getRewardTier(price);
  const included = parseIncludedServices(service.description || "");

  const waMessage = `Hello Concept Cleaning Services,\n\nI would like to book the following package:\n\nPackage: ${service.name}\n\nServices Included:\n${included.map((s) => `- ${s}`).join("\n")}\n\nTotal Price: KES ${discountedPrice.toLocaleString()}\n\n${reward ? `Free Rewards:\n${reward.items.map((i) => `- ${i}`).join("\n")}\n\n` : ""}Please confirm availability.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl bg-cream border border-gold/40 hover:border-terracotta/60 shadow-card hover:shadow-soft transition-all p-6 flex flex-col"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-lg">{service.name}</h3>
        {reward && (
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-terracotta/15 text-terracotta-dark">
            {reward.label}
          </span>
        )}
      </div>

      <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{service.description?.split("Includes")[0]?.trim()}</p>

      <div className="mb-3">
        {discount > 0 && (
          <span className="text-sm text-muted-foreground line-through mr-2">KES {price.toLocaleString()}</span>
        )}
        <span className="text-xl font-bold text-terracotta-dark">KES {discountedPrice.toLocaleString()}</span>
      </div>


      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-sm font-semibold text-terracotta-dark mb-3"
      >
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        View Package
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {included.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Services Included</p>
                <ul className="space-y-1">
                  {included.map((s) => (
                    <li key={s} className="text-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {reward && (
              <div className="mb-3 p-3 rounded-xl bg-accent/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">🎁 Free Rewards</p>
                <ul className="space-y-1">
                  {reward.items.map((item) => (
                    <li key={item} className="text-sm flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-primary shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 mt-auto pt-2">
        <Button asChild size="sm" className="flex-1">
          <Link to={`/booking?service=${encodeURIComponent(service.name)}`}>Book This Package</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="text-[hsl(142,70%,45%)] border-[hsl(142,70%,45%)]">
          <a href={whatsappLink(waMessage)} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-4 h-4" />
          </a>
        </Button>
      </div>
    </motion.div>
  );
};

export default PackageCard;
