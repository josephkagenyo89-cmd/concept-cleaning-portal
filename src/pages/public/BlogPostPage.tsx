import { ReactNode, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Link2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PublicShell from '@/components/public/PublicShell';
import { BlogPost, fetchPostBySlug, fetchPublishedPosts, fmtBlogDate, readingTime } from '@/lib/blog';

/** Minimal, safe Markdown renderer: ## headings, - lists, > quotes, **bold**, paragraphs. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
}
export function renderContent(src: string) {
  const blocks = (src || '').replace(/\r/g, '').split(/\n{2,}/);
  return blocks.map((b, i) => {
    const t = b.trim();
    if (!t) return null;
    if (t.startsWith('### ')) return <h3 key={i} className="mt-6 text-lg font-semibold">{inline(t.slice(4))}</h3>;
    if (t.startsWith('## ')) return <h2 key={i} className="mt-8 text-xl font-bold md:text-2xl">{inline(t.slice(3))}</h2>;
    if (t.startsWith('> ')) return <blockquote key={i} className="my-4 border-l-4 border-market pl-4 italic text-muted-foreground">{inline(t.replace(/^>\s?/gm, ''))}</blockquote>;
    const lines = t.split('\n');
    if (lines.every((l) => /^[-*]\s/.test(l))) return <ul key={i} className="my-4 list-disc space-y-1 pl-6">{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
    if (lines.every((l) => /^\d+\.\s/.test(l))) return <ol key={i} className="my-4 list-decimal space-y-1 pl-6">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\.\s/, ''))}</li>)}</ol>;
    return <p key={i} className="my-4 leading-relaxed">{lines.map((l, j) => <span key={j}>{inline(l)}{j < lines.length - 1 && <br />}</span>)}</p>;
  });
}

export default function BlogPostPage() {
  const { slug = '' } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPostBySlug(slug).then((p) => { setPost(p); setLoading(false); });
    fetchPublishedPosts(4).then((r) => setRelated(r.filter((x) => x.slug !== slug).slice(0, 3)));
    window.scrollTo(0, 0);
  }, [slug]);

  const url = `https://www.conceptcleaningservices.co.ke/blog/${slug}`;

  if (loading) return <PublicShell><p className="mx-auto max-w-3xl px-4 py-16 text-muted-foreground">Loading…</p></PublicShell>;
  if (!post) return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Article not found</h1>
        <Button asChild className="mt-4"><Link to="/blog">Back to blog</Link></Button>
      </div>
    </PublicShell>
  );

  const title = post.meta_title || `${post.title} | Concept Cleaning Blog`;
  const desc = post.meta_description || post.excerpt || '';

  return (
    <PublicShell>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        {post.cover_image && <meta property="og:image" content={post.cover_image} />}
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org', '@type': 'BlogPosting',
          headline: post.title, description: desc, image: post.cover_image || undefined,
          datePublished: post.published_at, dateModified: post.updated_at,
          author: { '@type': 'Organization', name: post.author_name },
          publisher: { '@type': 'Organization', name: 'Concept Cleaning Services' },
          mainEntityOfPage: url,
        })}</script>
      </Helmet>

      <article className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All articles</Link>
        <p className="mt-6 text-xs font-semibold uppercase text-market">{post.category}</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight md:text-4xl">{post.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{post.author_name} · {fmtBlogDate(post.published_at)} · {readingTime(post.content)} min read</p>
        {post.cover_image && <img src={post.cover_image} alt={post.title} className="mt-6 w-full rounded-2xl object-cover" />}
        <div className="mt-6 text-base md:text-lg">{renderContent(post.content)}</div>

        {post.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">{post.tags.map((t) => <span key={t} className="rounded-full bg-muted px-3 py-1 text-xs">#{t}</span>)}</div>
        )}

        <div className="mt-8 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><a href={`https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-1 h-4 w-4" />Share on WhatsApp</a></Button>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copied'); }}><Link2 className="mr-1 h-4 w-4" />Copy link</Button>
        </div>

        <div className="mt-10 rounded-2xl bg-market p-6 text-market-foreground md:p-8">
          <h2 className="text-xl font-bold">Need a professional to handle it?</h2>
          <p className="mt-1 opacity-90">Our trained Nairobi team is ready — book in minutes.</p>
          <Button asChild className="mt-4 bg-background text-foreground hover:bg-background/90"><Link to="/marketplace">Book a Service</Link></Button>
        </div>
      </article>

      {related.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="text-xl font-bold">More articles</h2>
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            {related.map((p) => (
              <Link key={p.id} to={`/blog/${p.slug}`} className="rounded-2xl border bg-card p-5 hover:shadow-lg">
                <p className="text-xs uppercase text-market">{p.category}</p>
                <h3 className="mt-1 font-semibold">{p.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
