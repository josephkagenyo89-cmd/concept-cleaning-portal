import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import PageHead from "@/components/PageHead";
import PackageCard from "@/components/PackageCard";
import { useDiscount } from "@/hooks/useDiscount";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

const formatPrice = (s: any) => {
  if (s.price_type === "custom") return "Get a Quote";
  if (s.price_type === "per_sqm") return `KES ${Number(s.price_value).toLocaleString()}/sqm`;
  if (s.price_type === "per_unit") return `KES ${Number(s.price_value).toLocaleString()}/${s.pricing_unit || "unit"}`;
  if (s.price_type === "range") return `From KES ${Number(s.price_value).toLocaleString()}`;
  return `From KES ${Number(s.price_value).toLocaleString()}`;
};

const Services = () => {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { discount, applyDiscount } = useDiscount();

  useEffect(() => {
    supabase.from("services").select("*, service_categories(name)").eq("is_active", true).order("name").then(({ data }) => {
      setServices((data ?? []).map((s: any) => ({ ...s, category: s.service_categories?.name?.trim() ?? "Other", price_value: Number(s.base_price ?? 0), price_type: s.pricing_model === "variation" ? "range" : s.pricing_model === "per_unit" && s.pricing_unit === "sqm" ? "per_sqm" : s.pricing_model })));
      setLoading(false);
    });
  }, []);

  const packages = services.filter((s) => s.category === "Package");
  const individual = services.filter((s) => s.category !== "Package");

  return (
    <div>
      <PageHead
        title="Professional Cleaning Services in Nairobi, Kiambu, Kajiado & Machakos"
        description="Browse our full range of professional cleaning services including sofa cleaning, carpet cleaning, deep cleaning, fumigation, car detailing and combo packages."
        keywords="cleaning services Nairobi, sofa cleaning, carpet cleaning, deep cleaning, fumigation, car detailing, cleaning packages"
        canonical="https://concept-cleaning-kenya.lovable.app/services"
      />

      <section className="section-padding bg-foreground text-background pt-24 sm:pt-32">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">Our <span className="text-primary">Services</span></h1>
            <p className="text-background/60 text-lg">Quality cleaning solutions for every need.</p>
          </motion.div>
        </div>
      </section>

      {/* Packages Section */}
      {packages.length > 0 && (
        <section className="section-padding bg-accent/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">🔥 Combo Packages</h2>
              <p className="text-muted-foreground">Save more with packages + FREE cleaning products</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} service={pkg} discount={discount} applyDiscount={applyDiscount} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Individual Services */}
      <section className="section-padding">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Individual Services</h2>
          {loading && <p className="text-center text-muted-foreground">Loading...</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {individual.map((service, i) => (
              <motion.div key={service.id} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="p-6 rounded-2xl bg-card border border-border hover:shadow-lg transition-shadow flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-accent-foreground" />
                </div>
                <h3 className="font-bold text-lg mb-2">{service.name}</h3>
                <p className="text-muted-foreground text-sm mb-4 flex-1 line-clamp-3">{service.description}</p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-sm font-semibold text-primary">{formatPrice(service)}</span>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/services/${service.slug}`}>Details</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link to={`/booking?service=${encodeURIComponent(service.name)}`}>Book</Link>
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Services;
