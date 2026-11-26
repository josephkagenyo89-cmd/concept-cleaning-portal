import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageHead from "@/components/PageHead";
import { Button } from "@/components/ui/button";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle()
      .then(({ data }) => {
        setPost(data);
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return <div className="section-padding pt-32 text-center text-muted-foreground">Loading...</div>;
  }

  if (!post) {
    return (
      <div className="section-padding pt-32 text-center">
        <h1 className="text-2xl font-bold mb-4">Post not found</h1>
        <Button asChild>
          <Link to="/blog">Back to Blog</Link>
        </Button>
      </div>
    );
  }

  const date = new Date((post.published_at ?? post.created_at)).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <PageHead
        title={post.meta_title || `${post.title} | Concept Cleaning Blog`}
        description={post.meta_description || post.excerpt || post.title}
        keywords={(post.tags ?? []).join(", ")}
        canonical={`https://concept-cleaning-kenya.lovable.app/blog/${post.slug}`}
      />

      <article className="section-padding pt-24 sm:pt-32">
        <div className="max-w-3xl mx-auto">
          <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </Link>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Calendar className="w-4 h-4" /> {date}
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-6">{post.title}</h1>

          {post.cover_image && (
            <img
              src={post.cover_image}
              alt={post.title}
              loading="eager"
              className="w-full rounded-2xl mb-8 aspect-[16/9] object-cover"
            />
          )}

          {post.excerpt && (
            <p className="text-lg text-muted-foreground leading-relaxed mb-6 italic">{post.excerpt}</p>
          )}

          <div className="prose prose-lg max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
            {post.content}
          </div>
        </div>
      </article>
    </div>
  );
};

export default BlogPost;
