import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import PageHead from "@/components/PageHead";
import ImageCompareSlider, { type ImageComparison } from "@/components/ImageCompareSlider";

const INITIAL_COUNT = 6;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const Portfolio = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  useEffect(() => {
    supabase
       .from("portfolio_posts")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPosts(data ?? []);
        setLoading(false);
      });
  }, []);

  const categories = ["All", ...Array.from(new Set(posts.map((p) => p.category)))];
  const filtered = filter === "All" ? posts : posts.filter((p) => p.category === filter);
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const handleFilterChange = (cat: string) => {
    setFilter(cat);
    setVisibleCount(INITIAL_COUNT);
  };

  return (
    <div>
      <PageHead
        title="Cleaning Work in Nairobi & Surrounding Areas | Before & After Results"
        description="See our professional cleaning results across Nairobi, Kiambu, Kajiado and Machakos. Before and after photos of sofa cleaning, carpet cleaning, deep cleaning and car detailing."
        keywords="cleaning results Nairobi, before after cleaning, sofa cleaning results, carpet cleaning Nairobi"
        canonical="https://concept-cleaning-kenya.lovable.app/portfolio"
      />

      <section className="section-padding bg-foreground text-background pt-24 sm:pt-32">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">Our <span className="text-primary">Work</span></h1>
            <p className="text-background/60 text-lg">See the difference we make — before and after.</p>
          </motion.div>
        </div>
      </section>

      <section className="section-padding">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleFilterChange(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading && <p className="text-muted-foreground">Loading...</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((item) => (
              <motion.div
                key={item.id}
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="rounded-2xl overflow-hidden bg-card border border-border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelected(item)}
              >
                <ImageCompareSlider
                  showHint={false}
                  aspectClassName="aspect-[3/2]"
                  comparisons={[{
                    id: String(item.id),
                    label: item.category,
                    beforeImage: item.before_image_url,
                    afterImage: item.after_image_url,
                    beforeAlt: `Before: ${item.title}`,
                    afterAlt: `After: ${item.title}`,
                  } satisfies ImageComparison]}
                />
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-sm">{item.title}</h3>
                    <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">{item.category}{item.location ? ` • ${item.location}` : ""}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-8">
              <Button variant="outline" size="lg" onClick={() => setVisibleCount((c) => c + 6)}>
                Load More
              </Button>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No portfolio posts yet.</p>
          )}
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/80 flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="font-bold text-lg">{selected.title}</h2>
                <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
              </div>
              <div className="px-4 pt-4">
                <ImageCompareSlider
                  aspectClassName="aspect-[4/3]"
                  comparisons={[{
                    id: String(selected.id),
                    label: selected.category,
                    beforeImage: selected.before_image_url,
                    afterImage: selected.after_image_url,
                    beforeAlt: `Before: ${selected.title}`,
                    afterAlt: `After: ${selected.title}`,
                  }]}
                />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium bg-accent text-accent-foreground px-2.5 py-1 rounded-full">{selected.category}</span>
                  {selected.location && <span className="text-xs text-muted-foreground">{selected.location}</span>}
                  <span className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">{selected.description}</p>
                <div className="flex gap-2">
                  <Button asChild size="sm"><Link to="/booking">Book Similar Service</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link to="/services">View Services</Link></Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Portfolio;
