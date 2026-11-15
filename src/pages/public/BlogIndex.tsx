import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, BookOpen, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PublicShell from '@/components/public/PublicShell';
import { BlogPost, fetchPublishedPosts, fmtBlogDate, readingTime } from '@/lib/blog';
import { cn } from '@/lib/utils';

export function HomeBlogPreview() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchPublishedPosts(3)
      .then((published) => { if (mounted) setPosts(published); })
      .catch(() => { if (mounted) setFailed(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <section id="blog" className="scroll-mt-24 border-b border-[var(--border)] bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#0F766E]">From our team</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Cleaning tips &amp; expert advice</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Practical cleaning guidance, hygiene insights and pest-control advice for homes and businesses.</p>
          </div>
          <Link to="/blog" className="inline-flex shrink-0 items-center gap-2 text-sm font-extrabold text-[#0F766E] hover:text-[#115E59]">Visit the blog <ArrowRight className="h-4 w-4" /></Link>
        </div>
        {loading ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">Loading the latest articles…</div>
        ) : failed ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Articles are temporarily unavailable. Please visit the blog again shortly.</div>
        ) : posts.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-lg">
                {post.cover_image ? <img src={post.cover_image} alt={post.title} loading="lazy" className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="flex aspect-[16/9] items-center justify-center bg-[#E7F2F1] text-[#0F766E]"><BookOpen className="h-10 w-10" /></div>}
                <div className="p-5">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#0F766E]">{post.category}</p>
                  <h3 className="mt-2 text-lg font-extrabold leading-snug text-slate-900 group-hover:text-[#0F766E]">{post.title}</h3>
                  {post.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>}
                  <p className="mt-4 text-xs font-medium text-slate-500">{fmtBlogDate(post.published_at)} · {readingTime(post.content)} min read</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <BookOpen className="mx-auto h-9 w-9 text-slate-400" />
            <h3 className="mt-3 font-extrabold text-slate-900">New articles coming soon</h3>
            <p className="mt-2 text-sm text-slate-600">Our team is preparing useful cleaning and pest-control guides. Check the blog for new publications.</p>
          </div>
        )}
      </div>
    </section>
  );
}

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
        <link rel="canonical" href="https://www.conceptcleaningservices.co.ke/blog" />
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
