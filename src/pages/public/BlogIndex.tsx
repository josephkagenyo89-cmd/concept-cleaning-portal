import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PublicShell from '@/components/public/PublicShell';
import { BlogPost, fetchPublishedPosts, fmtBlogDate, readingTime } from '@/lib/blog';
import { cn } from '@/lib/utils';

export default function BlogIndex() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');

  useEffect(() => { fetchPublishedPosts(200).then((p) => { setPosts(p); setLoading(false); }); }, []);

  const cats = useMemo(() => ['All', ...Array.from(new Set(posts.map((p) => p.category)))], [posts]);
  const list = posts.filter((p) =>
    (cat === 'All' || p.category === cat) &&
    (!q || `${p.title} ${p.excerpt} ${p.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  const [featured, ...rest] = list;

  return (
    <PublicShell>
      <Helmet>
        <title>Cleaning Tips & Pest Control Guides | Concept Cleaning Blog</title>
        <meta name="description" content="Expert cleaning tips, stain removal guides and pest control advice for homes and offices in Nairobi, Kenya." />
        <link rel="canonical" href="https://conceptcleaningke.lovable.app/blog" />
      </Helmet>
      <section className="bg-market-soft">
        <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <h1 className="text-3xl font-extrabold md:text-4xl">Cleaning tips & guides</h1>
          <p className="mt-2 text-muted-foreground">Practical advice from Nairobi's cleaning and pest control experts.</p>
          <div className="relative mt-6 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search articles" className="h-11 bg-background pl-9" />
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {cats.map((c) => (
              <button key={c} onClick={() => setCat(c)}
                className={cn('shrink-0 rounded-full border px-3 py-1.5 text-sm', cat === c ? 'bg-market text-market-foreground border-market' : 'bg-background')}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        {loading ? <p className="text-muted-foreground">Loading…</p> : list.length === 0 ? (
          <p className="text-muted-foreground">No articles yet. Check back soon.</p>
        ) : (
          <>
            {featured && (
              <Link to={`/blog/${featured.slug}`} className="grid overflow-hidden rounded-2xl border bg-card md:grid-cols-2">
                {featured.cover_image && <img src={featured.cover_image} alt={featured.title} className="aspect-[16/10] h-full w-full object-cover" />}
                <div className="p-6 md:p-8">
                  <p className="text-xs font-semibold uppercase text-market">{featured.category}</p>
                  <h2 className="mt-2 text-2xl font-bold">{featured.title}</h2>
                  <p className="mt-2 text-muted-foreground">{featured.excerpt}</p>
                  <p className="mt-4 text-xs text-muted-foreground">{fmtBlogDate(featured.published_at)} · {readingTime(featured.content)} min read</p>
                </div>
              </Link>
            )}
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className="overflow-hidden rounded-2xl border bg-card transition hover:shadow-lg">
                  {p.cover_image && <img src={p.cover_image} alt={p.title} loading="lazy" className="aspect-[16/9] w-full object-cover" />}
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase text-market">{p.category}</p>
                    <h3 className="mt-1 font-semibold leading-snug">{p.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{fmtBlogDate(p.published_at)} · {readingTime(p.content)} min read</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </PublicShell>
  );
}
