import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Pencil, Trash2, Save, X, Upload, Eye, EyeOff, Share2,
  Facebook, Instagram, Copy, Link as LinkIcon, ExternalLink,
} from "lucide-react";
import { slugify } from "@/lib/slug";
import { buildSocialCaption, buildHashtags, BLOG_CATEGORIES, SITE_URL } from "@/lib/social";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  publish_date: string;
  is_published: boolean;
  meta_title: string | null;
  meta_description: string | null;
  keywords: string | null;
  category: string | null;
  share_disabled: boolean;
}

const empty: Omit<BlogPost, "id"> = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  featured_image_url: "",
  publish_date: new Date().toISOString().slice(0, 10),
  is_published: false,
  meta_title: "",
  meta_description: "",
  keywords: "",
  category: "Cleaning Tips",
  share_disabled: false,
};

const AdminBlog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shareTarget, setShareTarget] = useState<BlogPost | null>(null);
  const [shareCaption, setShareCaption] = useState("");
  const [shareHashtags, setShareHashtags] = useState("");
  const [shareImage, setShareImage] = useState<string>("");
  const { toast } = useToast();

  const load = () => {
    supabase
      .from("blog_posts")
      .select("*")
      .order("publish_date", { ascending: false })
      .then(({ data }) => setPosts((data as BlogPost[]) ?? []));
  };

  useEffect(load, []);

  const handleUpload = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("blog").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("blog").getPublicUrl(path);
      setEditing({ ...editing, featured_image_url: data.publicUrl });
      toast({ title: "Image uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    const slug = (editing.slug || slugify(editing.title)).trim();
    const payload = {
      title: editing.title,
      slug,
      excerpt: editing.excerpt || null,
      content: editing.content,
      featured_image_url: editing.featured_image_url || null,
      publish_date: editing.publish_date,
      is_published: editing.is_published,
      meta_title: editing.meta_title || null,
      meta_description: editing.meta_description || null,
      keywords: editing.keywords || null,
      category: editing.category || null,
      share_disabled: editing.share_disabled,
      updated_at: new Date().toISOString(),
    };

    const wasUnpublished = !isNew && posts.find((p) => p.id === editing.id)?.is_published === false;
    const { error } = isNew
      ? await supabase.from("blog_posts").insert(payload)
      : await supabase.from("blog_posts").update(payload).eq("id", editing.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isNew ? "Post created" : "Post updated" });
    const savedPost = { ...editing, slug } as BlogPost;
    setEditing(null);
    setIsNew(false);
    load();
    // Auto-open share helper when a post becomes published
    if (savedPost.is_published && !savedPost.share_disabled && (isNew || wasUnpublished)) {
      openShare(savedPost);
    }
  };

  const openShare = (p: BlogPost) => {
    if (p.share_disabled) {
      toast({ title: "Sharing is disabled for this post" });
      return;
    }
    setShareTarget(p);
    setShareCaption(buildSocialCaption(p.title, p.excerpt, p.slug));
    setShareHashtags(buildHashtags({ title: p.title, category: p.category, keywords: p.keywords }));
    setShareImage(p.featured_image_url ?? "");
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const blogLink = (slug: string) => `${SITE_URL}/blog/${slug}`;

  const fullCaption = () =>
    shareHashtags.trim() ? `${shareCaption}\n\n${shareHashtags}` : shareCaption;

  const shareToFacebook = () => {
    if (!shareTarget) return;
    const link = blogLink(shareTarget.slug);
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(fullCaption())}`;
    // Auto-copy caption so user can paste if Facebook strips quote (they often do)
    navigator.clipboard.writeText(fullCaption()).catch(() => {});
    window.open(url, "_blank", "width=640,height=640,noopener");
    toast({ title: "Caption copied — paste into Facebook if needed" });
  };

  const shareToInstagram = async () => {
    if (!shareTarget) return;
    await navigator.clipboard.writeText(fullCaption()).catch(() => {});
    toast({ title: "Caption + hashtags copied", description: "Open Instagram and paste into your new post." });
    // Try native share first (great on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTarget.title,
          text: fullCaption(),
          url: blogLink(shareTarget.slug),
        });
        return;
      } catch {/* user cancelled */}
    }
    window.open("https://www.instagram.com/", "_blank", "noopener");
  };

  const togglePublish = async (p: BlogPost) => {
    const newVal = !p.is_published;
    await supabase.from("blog_posts").update({ is_published: newVal }).eq("id", p.id);
    toast({ title: newVal ? "Published" : "Unpublished" });
    load();
    if (newVal && !p.share_disabled) openShare({ ...p, is_published: true });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this blog post?")) return;
    await supabase.from("blog_posts").delete().eq("id", id);
    toast({ title: "Post deleted" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Blog Posts</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing({ id: "", ...empty } as BlogPost);
            setIsNew(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> New Post
        </Button>
      </div>

      {editing && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">{isNew ? "New Blog Post" : "Edit Post"}</CardTitle>
            <button onClick={() => { setEditing(null); setIsNew(false); }} className="p-1 rounded hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Title"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: isNew && !editing.slug ? slugify(e.target.value) : editing.slug })}
            />
            <Input
              placeholder="URL slug (e.g. sofa-cleaning-tips-nairobi)"
              value={editing.slug}
              onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })}
            />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Category</p>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editing.category ?? ""}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              >
                <option value="">— None —</option>
                {BLOG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <Textarea
              placeholder="Short excerpt / summary (shown on cards)"
              value={editing.excerpt ?? ""}
              onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
              rows={2}
            />
            <Textarea
              placeholder="Full article content"
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              rows={10}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Featured Image</p>
              {editing.featured_image_url && (
                <img src={editing.featured_image_url} alt="" className="w-full max-w-sm rounded-lg aspect-[16/9] object-cover" />
              )}
              <div className="flex gap-2 items-center flex-wrap">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background hover:bg-accent text-sm cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Upload Image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  />
                </label>
                <Input
                  placeholder="Or paste image URL"
                  value={editing.featured_image_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, featured_image_url: e.target.value })}
                  className="flex-1 min-w-[200px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Publish date</p>
                <Input
                  type="date"
                  value={editing.publish_date}
                  onChange={(e) => setEditing({ ...editing, publish_date: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm pt-6">
                <input
                  type="checkbox"
                  checked={editing.is_published}
                  onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                />
                Published
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.share_disabled}
                onChange={(e) => setEditing({ ...editing, share_disabled: e.target.checked })}
              />
              Disable social sharing for this post
            </label>

            <div className="pt-3 border-t border-border space-y-3">
              <p className="text-sm font-medium">SEO</p>
              <Input
                placeholder="SEO title"
                value={editing.meta_title ?? ""}
                onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })}
              />
              <Textarea
                placeholder="Meta description"
                value={editing.meta_description ?? ""}
                onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })}
                rows={2}
              />
              <Input
                placeholder="Keywords (comma-separated)"
                value={editing.keywords ?? ""}
                onChange={(e) => setEditing({ ...editing, keywords: e.target.value })}
              />
            </div>

            <Button onClick={save}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <div className="w-14 h-14 rounded bg-muted overflow-hidden flex-shrink-0">
              {p.featured_image_url && <img src={p.featured_image_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground">
                /{p.slug} • {new Date(p.publish_date).toLocaleDateString()} •{" "}
                <span className={p.is_published ? "text-primary" : "text-muted-foreground"}>
                  {p.is_published ? "Published" : "Draft"}
                </span>
                {p.share_disabled && <span className="ml-1 text-muted-foreground">• share off</span>}
              </p>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => openShare(p)} title="Share to social media" disabled={p.share_disabled}>
                <Share2 className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => togglePublish(p)} title={p.is_published ? "Unpublish" : "Publish"}>
                {p.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setIsNew(false); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No blog posts yet.</p>
        )}
      </div>

      <Dialog open={!!shareTarget} onOpenChange={(o) => !o && setShareTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share to Social Media</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {shareImage && (
              <img src={shareImage} alt="" className="w-full max-h-48 object-cover rounded-lg" />
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Featured image URL</p>
              <Input value={shareImage} onChange={(e) => setShareImage(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Caption (editable)</p>
                <button type="button" onClick={() => copyText(shareCaption, "Caption")} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Copy Caption
                </button>
              </div>
              <Textarea rows={7} value={shareCaption} onChange={(e) => setShareCaption(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground">Hashtags (auto-generated, editable)</p>
                <button type="button" onClick={() => copyText(shareHashtags, "Hashtags")} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Copy Hashtags
                </button>
              </div>
              <Textarea rows={3} value={shareHashtags} onChange={(e) => setShareHashtags(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => shareTarget && copyText(blogLink(shareTarget.slug), "Blog link")}>
                <LinkIcon className="w-4 h-4 mr-1" /> Copy Blog Link
              </Button>
              <Button variant="outline" size="sm" onClick={() => copyText(fullCaption(), "Full caption")}>
                <Copy className="w-4 h-4 mr-1" /> Copy All
              </Button>
              {shareTarget && (
                <a
                  href={blogLink(shareTarget.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1"
                >
                  <ExternalLink className="w-3 h-3" /> Preview post
                </a>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              Tip: caption is auto-copied to your clipboard when you click a share button. Just paste it into the Facebook or Instagram post.
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button onClick={shareToFacebook} className="bg-[#1877F2] text-white hover:bg-[#1877F2]/90">
              <Facebook className="w-4 h-4 mr-1" /> Share to Facebook
            </Button>
            <Button onClick={shareToInstagram} className="bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white hover:opacity-90">
              <Instagram className="w-4 h-4 mr-1" /> Share to Instagram
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBlog;
