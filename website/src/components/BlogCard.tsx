import { Link } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BlogCardProps {
  post: {
    slug: string;
    title: string;
    excerpt?: string | null;
    featured_image_url?: string | null;
    publish_date: string;
  };
}

const BlogCard = ({ post }: BlogCardProps) => {
  const date = new Date(post.publish_date).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="group rounded-2xl overflow-hidden bg-card border border-border hover:shadow-lg transition-all flex flex-col">
      <Link to={`/blog/${post.slug}`} className="block aspect-[16/10] bg-muted overflow-hidden">
        {post.featured_image_url ? (
          <img
            src={post.featured_image_url}
            alt={post.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No image</div>
        )}
      </Link>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <Calendar className="w-3.5 h-3.5" /> {date}
        </div>
        <h3 className="font-semibold text-lg leading-snug mb-2 line-clamp-2">
          <Link to={`/blog/${post.slug}`} className="hover:text-primary transition-colors">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && (
          <p className="text-muted-foreground text-sm line-clamp-3 mb-4">{post.excerpt}</p>
        )}
        <div className="mt-auto">
          <Button asChild variant="outline" size="sm">
            <Link to={`/blog/${post.slug}`}>
              Read More <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
};

export default BlogCard;
