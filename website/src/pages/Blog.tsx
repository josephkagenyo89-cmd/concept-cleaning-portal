import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import BlogCard from "@/components/BlogCard";
import PageHead from "@/components/PageHead";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 9;

const Blog = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("blog_posts")
      .select("*")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setPosts(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <PageHead
        title="Cleaning Tips & News | Concept Cleaning Services Blog"
        description="Read the latest cleaning tips, guides, and news from Concept Cleaning Services Nairobi. Expert advice on sofa, carpet, home, and car cleaning."
        keywords="cleaning blog Nairobi, cleaning tips Kenya, sofa cleaning guide, home cleaning advice"
        canonical="https://concept-cleaning-kenya.lovable.app/blog"
      />

      <section className="section-padding pt-24 sm:pt-32 bg-muted/30">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Blog & News</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Cleaning tips, guides, and updates from our team in Nairobi.
          </p>
        </div>
      </section>

      <section className="section-padding">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <p className="text-center text-muted-foreground py-12">Loading...</p>
          ) : posts.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No posts yet. Check back soon!</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.slice(0, visible).map((p) => (
                  <BlogCard key={p.id} post={p} />
                ))}
              </div>
              {visible < posts.length && (
                <div className="text-center mt-10">
                  <Button onClick={() => setVisible((v) => v + PAGE_SIZE)} variant="outline" size="lg">
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default Blog;
