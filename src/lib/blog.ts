import { supabase } from '@/integrations/supabase/client';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  category: string;
  tags: string[];
  author_name: string;
  is_published: boolean;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export const BLOG_CATEGORIES = [
  'Cleaning Tips',
  'Pest Control Guides',
  'Commercial Cleaning',
  'Carpet & Upholstery',
  'Health & Hygiene',
  'Company News',
];

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 90);

export const readingTime = (content: string) =>
  Math.max(1, Math.round((content || '').split(/\s+/).filter(Boolean).length / 200));

export const fmtBlogDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export async function fetchPublishedPosts(limit = 50): Promise<BlogPost[]> {
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(limit);
  return (data as BlogPost[]) || [];
}

export async function fetchPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data } = await supabase.from('blog_posts').select('*').eq('slug', slug).maybeSingle();
  return (data as BlogPost) || null;
}
