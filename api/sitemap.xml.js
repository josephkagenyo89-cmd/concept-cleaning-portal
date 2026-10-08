import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const base = 'https://www.conceptcleaningservices.co.ke';
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    if (!url || !key) throw new Error('Supabase environment is not configured');
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from('blog_posts')
      .select('slug,published_at,updated_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (error) throw error;

    const staticUrls = [
      { loc: '/', changefreq: 'weekly', priority: '1.0' },
      { loc: '/categories', changefreq: 'weekly', priority: '0.8' },
      { loc: '/marketplace', changefreq: 'weekly', priority: '0.9' },
      { loc: '/blog', changefreq: 'weekly', priority: '0.8' },
    ];

    const urls = staticUrls.map((u) => '<url><loc>' + base + u.loc + '</loc><changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority + '</priority></url>');
    for (const post of data || []) {
      const lastmod = post.updated_at || post.published_at;
      urls.push('<url><loc>' + base + '/blog/' + encodeURIComponent(post.slug) + '</loc>' + (lastmod ? '<lastmod>' + new Date(lastmod).toISOString().slice(0, 10) + '</lastmod>' : '') + '<changefreq>monthly</changefreq><priority>0.7</priority></url>');
    }

    const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.join('') + '</urlset>';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Sitemap generation failed', error);
    return res.status(500).send('Sitemap generation failed');
  }
}
