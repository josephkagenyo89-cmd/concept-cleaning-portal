CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  category TEXT NOT NULL DEFAULT 'Cleaning Tips',
  tags TEXT[] NOT NULL DEFAULT '{}',
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Concept Cleaning Team',
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  meta_title TEXT,
  meta_description TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_posts_published_idx
  ON public.blog_posts (is_published, published_at DESC);

CREATE INDEX IF NOT EXISTS blog_posts_category_idx
  ON public.blog_posts (category);

CREATE INDEX IF NOT EXISTS blog_posts_slug_idx
  ON public.blog_posts (slug);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published blog posts" ON public.blog_posts;
CREATE POLICY "Public can view published blog posts"
  ON public.blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "Admins can manage blog posts" ON public.blog_posts;
CREATE POLICY "Admins can manage blog posts"
  ON public.blog_posts
  FOR ALL
  TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_blog_posts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON public.blog_posts;

CREATE TRIGGER trg_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_blog_posts_updated_at();
