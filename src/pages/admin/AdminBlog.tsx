import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ExternalLink, Search } from 'lucide-react';
import { BLOG_CATEGORIES, BlogPost, fmtBlogDate, slugify } from '@/lib/blog';

type Draft = Partial<BlogPost> & { tagsText?: string };
const EMPTY: Draft = { title: '', slug: '', excerpt: '', content: '', cover_image: '', category: BLOG_CATEGORIES[0], tagsText: '', author_name: 'Concept Cleaning Team', is_published: false, meta_title: '', meta_description: '' };

export default function AdminBlog() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message); else setPosts((data as BlogPost[]) || []);
  };
  useEffect(() => { load(); }, []);

  const edit = (p?: BlogPost) => {
    setD(p ? { ...p, tagsText: p.tags.join(', ') } : EMPTY);
    setSlugTouched(!!p);
    setOpen(true);
  };

  const save = async () => {
    if (!d.title?.trim() || !d.content?.trim()) return toast.error('Title and content are required');
    const slug = slugify(d.slug || d.title);
    if (!slug) return toast.error('Invalid URL slug');
    setSaving(true);
    const payload = {
      title: d.title.trim(), slug, excerpt: d.excerpt || null, content: d.content,
      cover_image: d.cover_image || null, category: d.category || BLOG_CATEGORIES[0],
      tags: (d.tagsText || '').split(',').map((t) => t.trim()).filter(Boolean),
      author_name: d.author_name || 'Concept Cleaning Team', is_published: !!d.is_published,
      meta_title: d.meta_title || null, meta_description: d.meta_description || null,
    };
    const res = d.id
      ? await supabase.from('blog_posts').update(payload).eq('id', d.id)
      : await supabase.from('blog_posts').insert({ ...payload, author_id: user?.id ?? null });
    setSaving(false);
    if (res.error) return toast.error(res.error.message.includes('duplicate') ? 'That URL slug is already used' : res.error.message);
    toast.success('Post saved');
    setOpen(false);
    load();
  };

  const togglePublish = async (p: BlogPost) => {
    const { error } = await supabase.from('blog_posts').update({ is_published: !p.is_published }).eq('id', p.id);
    if (error) toast.error(error.message); else load();
  };
  const remove = async (p: BlogPost) => {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', p.id);
    if (error) toast.error(error.message); else { toast.success('Deleted'); load(); }
  };

  const list = posts.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()));
  const metaT = d.meta_title || d.title || '';
  const metaD = d.meta_description || d.excerpt || '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="text-sm text-muted-foreground">Write articles and publish them on the public website.</p>
        </div>
        <Button onClick={() => edit()}><Plus className="mr-1 h-4 w-4" />New Post</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts" className="pl-9" />
      </div>

      <div className="divide-y rounded-lg border bg-card">
        {list.length === 0 && <p className="p-6 text-sm text-muted-foreground">No posts yet. Click "New Post" to write your first article.</p>}
        {list.map((p) => (
          <div key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            {p.cover_image ? <img src={p.cover_image} alt="" className="h-16 w-24 shrink-0 rounded object-cover" /> : <div className="h-16 w-24 shrink-0 rounded bg-muted" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.title}</p>
              <p className="text-xs text-muted-foreground">/blog/{p.slug} · {p.category} · {p.is_published ? `Published ${fmtBlogDate(p.published_at)}` : `Draft, updated ${fmtBlogDate(p.updated_at)}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={p.is_published ? 'default' : 'secondary'}>{p.is_published ? 'Published' : 'Draft'}</Badge>
              <Switch checked={p.is_published} onCheckedChange={() => togglePublish(p)} aria-label="Publish" />
              {p.is_published && <Button variant="ghost" size="icon" asChild><a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
              <Button variant="ghost" size="icon" onClick={() => edit(p)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{d.id ? 'Edit post' : 'New post'}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label>Title *</Label>
              <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value, slug: slugTouched ? d.slug : slugify(e.target.value) })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>URL slug</Label><Input value={d.slug} onChange={(e) => { setSlugTouched(true); setD({ ...d, slug: slugify(e.target.value) }); }} /></div>
              <div><Label>Category</Label>
                <Select value={d.category} onValueChange={(v) => setD({ ...d, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BLOG_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div><Label>Cover image URL</Label><Input value={d.cover_image || ''} onChange={(e) => setD({ ...d, cover_image: e.target.value })} placeholder="https://…" />
              {d.cover_image && <img src={d.cover_image} alt="" className="mt-2 h-32 rounded object-cover" />}</div>
            <div><Label>Short summary</Label><Textarea rows={2} value={d.excerpt || ''} onChange={(e) => setD({ ...d, excerpt: e.target.value })} /></div>
            <div><Label>Content *</Label>
              <Textarea rows={14} value={d.content} onChange={(e) => setD({ ...d, content: e.target.value })} className="font-mono text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">Leave a blank line between paragraphs. Use "## " for headings, "- " for bullet lists, "**bold**" for bold, "> " for a quote.</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Tags (comma separated)</Label><Input value={d.tagsText} onChange={(e) => setD({ ...d, tagsText: e.target.value })} /></div>
              <div><Label>Author</Label><Input value={d.author_name} onChange={(e) => setD({ ...d, author_name: e.target.value })} /></div>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm font-semibold">Google search preview</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div><Label>SEO title ({metaT.length}/60)</Label><Input value={d.meta_title || ''} onChange={(e) => setD({ ...d, meta_title: e.target.value })} placeholder={d.title} /></div>
                <div><Label>SEO description ({metaD.length}/160)</Label><Input value={d.meta_description || ''} onChange={(e) => setD({ ...d, meta_description: e.target.value })} placeholder={d.excerpt || ''} /></div>
              </div>
              <div className="mt-3 rounded bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">conceptcleaningke.lovable.app › blog › {d.slug || 'your-post'}</p>
                <p className="truncate text-base font-medium text-primary">{metaT || 'Post title'}</p>
                <p className="line-clamp-2 text-sm text-muted-foreground">{metaD || 'Short summary shown in search results.'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={!!d.is_published} onCheckedChange={(v) => setD({ ...d, is_published: v })} /><Label>Publish on website</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
