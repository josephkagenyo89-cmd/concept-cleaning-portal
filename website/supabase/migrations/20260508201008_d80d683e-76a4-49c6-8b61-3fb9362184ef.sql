CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  featured_image_url TEXT,
  publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  meta_title TEXT,
  meta_description TEXT,
  keywords TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view blog posts" ON public.blog_posts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert blog posts" ON public.blog_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update blog posts" ON public.blog_posts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete blog posts" ON public.blog_posts FOR DELETE USING (true);

CREATE INDEX idx_blog_posts_published ON public.blog_posts(is_published, publish_date DESC);
CREATE INDEX idx_blog_posts_slug ON public.blog_posts(slug);

INSERT INTO storage.buckets (id, name, public) VALUES ('blog', 'blog', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read blog images" ON storage.objects FOR SELECT USING (bucket_id = 'blog');
CREATE POLICY "Anyone can upload blog images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'blog');
CREATE POLICY "Anyone can update blog images" ON storage.objects FOR UPDATE USING (bucket_id = 'blog');
CREATE POLICY "Anyone can delete blog images" ON storage.objects FOR DELETE USING (bucket_id = 'blog');