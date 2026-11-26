import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowRight, MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/whatsapp";
import { Helmet } from "react-helmet-async";

const formatPrice = (s: any) => {
  if (s.price_type === "custom") return "Custom Quote";
  if (s.price_type === "per_sqm") return `KES ${Number(s.price_value).toLocaleString()}/sqm`;
  if (s.price_type === "per_unit") return `KES ${Number(s.price_value).toLocaleString()}/${s.pricing_unit || "unit"}`;
  if (s.price_type === "range") return `KES ${Number(s.price_value).toLocaleString()} – ${s.price_max ? Number(s.price_max).toLocaleString() : "..."}`;
  return `From KES ${Number(s.price_value).toLocaleString()}`;
};

const ServiceDetail = () => {
  const { slug } = useParams();
  const [service, setService] = useState<any | null>(null);
  const [relatedWork, setRelatedWork] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("services").select("*, service_categories(name)").eq("slug", slug).single();
      const serviceData = data ? { ...data, category: data.service_categories?.name?.trim() ?? "Other", price_value: Number(data.base_price ?? 0), price_type: data.pricing_model === "variation" ? "range" : data.pricing_model === "per_unit" && data.pricing_unit === "sqm" ? "per_sqm" : data.pricing_model } : null;
      setService(serviceData);
      if (serviceData) {
        const { data: work } = await supabase
          .from("portfolio_posts")
          .select("*")
          .eq("is_published", true)
          .eq("category", serviceData.category)
          .order("created_at", { ascending: false })
          .limit(4);
        setRelatedWork(work ?? []);
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (!service) return <div className="min-h-screen flex items-center justify-center"><p>Service not found.</p></div>;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": service.name,
    "description": service.description,
    "provider": {
      "@type": "LocalBusiness",
      "name": "Concept Cleaning Services",
      "telephone": "+254796563741",
      "areaServed": ["Nairobi", "Kiambu", "Kajiado", "Machakos"],
    },
    "offers": service.price_type !== "custom" ? {
      "@type": "Offer",
      "priceCurrency": "KES",
      "price": service.price_value,
    } : undefined,
  };

  return (
    <>
      <Helmet>
        <title>{service.meta_title || `${service.name} | Concept Cleaning Services`}</title>
        <meta name="description" content={service.meta_description || service.description} />
        {service.keywords && <meta name="keywords" content={service.keywords} />}
        <meta property="og:title" content={service.meta_title || service.name} />
        <meta property="og:description" content={service.meta_description || service.description} />
        <link rel="canonical" href={`https://concept-cleaning-kenya.lovable.app/services/${service.slug}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div>
        <section className="section-padding bg-foreground text-background pt-24 sm:pt-32">
          <div className="max-w-7xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
              <p className="text-primary text-sm font-medium mb-2">{service.category}</p>
              <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">{service.name}</h1>
              <p className="text-3xl font-bold text-primary mb-4">{formatPrice(service)}</p>
              <p className="text-background/60 text-lg leading-relaxed mb-8">{service.description}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg">
                  <Link to={`/booking?service=${encodeURIComponent(service.name)}`}>
                    Book This Service <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild size="lg" className="bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-primary-foreground">
                  <a href={whatsappLink(`Hello, I'm interested in ${service.name}. Can I get a quote?`)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4 mr-2" /> Get Quote on WhatsApp
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {relatedWork.length > 0 && (
          <section className="section-padding">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-2xl font-bold mb-6">Our {service.name} Work</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {relatedWork.map((item) => (
                  <div key={item.id} className="rounded-2xl overflow-hidden bg-card border border-border">
                    <div className="grid grid-cols-2 h-48">
                      <div className="relative">
                        {item.before_image_url ? <img src={item.before_image_url} alt="Before" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">Before</div>}
                        <span className="absolute bottom-2 left-2 text-xs font-medium bg-foreground/80 text-background px-2 py-0.5 rounded">Before</span>
                      </div>
                      <div className="relative">
                        {item.after_image_url ? <img src={item.after_image_url} alt="After" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground">After</div>}
                        <span className="absolute bottom-2 left-2 text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded">After</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm">{item.title}</h3>
                      <p className="text-muted-foreground text-xs line-clamp-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="section-padding bg-muted/50">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Book?</h2>
            <p className="text-muted-foreground mb-6">Get professional {service.name.toLowerCase()} services today.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg">
                <Link to={`/booking?service=${encodeURIComponent(service.name)}`}>Book Now</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/pricing">View All Pricing</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default ServiceDetail;
