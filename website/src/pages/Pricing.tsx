import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";
import { useDiscount } from "@/hooks/useDiscount";
import PageHead from "@/components/PageHead";
import PackageCard from "@/components/PackageCard";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

const Pricing = () => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { discount, applyDiscount } = useDiscount();

  useEffect(() => {
    supabase.from("services").select("*, service_categories(name)").eq("is_active", true).order("name").then(({ data }) => {
      setServices((data ?? []).map((s: any) => ({ ...s, category: s.service_categories?.name?.trim() ?? "Other", price_value: Number(s.base_price ?? 0), price_type: s.pricing_model === "variation" ? "range" : s.pricing_model === "per_unit" && s.pricing_unit === "sqm" ? "per_sqm" : s.pricing_model })));
      setLoading(false);
    });
  }, []);

  const formatPrice = (s: any, withDiscount: boolean) => {
    if (s.price_type === "custom") return "Get a Quote";
    const val = withDiscount ? applyDiscount(Number(s.price_value)) : Number(s.price_value);
    if (s.price_type === "per_sqm") return `KES ${val.toLocaleString()}/sqm`;
    if (s.price_type === "per_unit") return `KES ${val.toLocaleString()}/${s.pricing_unit || "unit"}`;
    if (s.price_type === "range") {
      const max = withDiscount && s.price_max ? applyDiscount(Number(s.price_max)) : (s.price_max ? Number(s.price_max) : null);
      return `KES ${val.toLocaleString()} – ${max ? max.toLocaleString() : "..."}`;
    }
    return `KES ${val.toLocaleString()}`;
  };

  const packages = services.filter((s) => s.category === "Package");
  const individual = services.filter((s) => s.category !== "Package");

  const grouped = individual.reduce<Record<string, any[]>>((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <PageHead
        title="Cleaning Prices in Nairobi | Affordable Packages & Rates"
        description="Transparent pricing for professional cleaning services in Nairobi. View our combo packages, individual service rates, and free reward offers."
        keywords="cleaning prices Nairobi, affordable cleaning, cleaning packages Kenya"
        canonical="https://concept-cleaning-kenya.lovable.app/pricing"
      />

      <section className="section-padding bg-foreground text-background pt-24 sm:pt-32">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">Our <span className="text-primary">Pricing</span></h1>
            <p className="text-background/60 text-lg">Transparent pricing for all our services.</p>
          </motion.div>
        </div>
      </section>

      <section className="section-padding">
        <div className="max-w-5xl mx-auto space-y-10">
          {discount > 0 && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
              <p className="text-primary font-bold text-lg">🎉 {discount}% OFF all services!</p>
            </div>
          )}
          {loading && <p className="text-center text-muted-foreground">Loading...</p>}

          {/* Packages */}
          {packages.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">🔥 Combo Packages</h2>
              <p className="text-muted-foreground text-sm mb-2">Save more with packages + FREE cleaning products</p>
              <p className="text-primary font-semibold text-sm mb-5 animate-pulse">🎁 Book any package and get FREE cleaning detergents!</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {packages.map((pkg) => (
                  <PackageCard key={pkg.id} service={pkg} discount={discount} applyDiscount={applyDiscount} />
                ))}
              </div>
            </div>
          )}

          {/* Individual */}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-2xl font-bold mb-5">{category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map((s: any, i: number) => (
                  <motion.div key={s.id} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                    className="p-5 rounded-2xl bg-card border border-border hover:shadow-md transition-shadow flex flex-col">
                    <h3 className="font-bold text-lg mb-1">{s.name}</h3>
                    <p className="text-muted-foreground text-sm mb-4 flex-1 line-clamp-2">{s.description}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        {discount > 0 && s.price_type !== "custom" && (
                          <span className="text-sm text-muted-foreground line-through mr-2">{formatPrice(s, false)}</span>
                        )}
                        <span className="text-lg font-bold text-primary">{formatPrice(s, true)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button asChild size="sm">
                          <Link to={`/booking?service=${encodeURIComponent(s.name)}`}>Book</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="text-[hsl(142,70%,45%)] border-[hsl(142,70%,45%)]">
                          <a href={whatsappLink(`Hello, I'm interested in ${s.name}. What are the options?`)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Pricing;
