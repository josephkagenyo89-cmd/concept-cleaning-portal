import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.conceptcleaningservices.co.ke';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatLastmod(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `<lastmod>${date.toISOString().slice(0, 10)}</lastmod>`;
}

function sitemapUrl(path, options = {}) {
  const lastmod = formatLastmod(options.lastmod);
  const changefreq = options.changefreq || 'monthly';
  const priority = options.priority || '0.7';

  return `<url><loc>${escapeXml(`${SITE_URL}${path}`)}</loc>${lastmod}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const [blogResult, serviceResult] = await Promise.all([
      supabase
        .from('blog_posts')
        .select('slug,published_at,updated_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false }),

      supabase
        .from('services')
        .select('id,slug,updated_at')
        .eq('is_active', true),
    ]);

    if (blogResult.error) throw blogResult.error;
    if (serviceResult.error) throw serviceResult.error;

    const staticUrls = [
      { loc: '/', changefreq: 'weekly', priority: '1.0' },
      { loc: '/services', changefreq: 'weekly', priority: '0.9' },
      { loc: '/about', changefreq: 'monthly', priority: '0.7' },
      { loc: '/gallery', changefreq: 'monthly', priority: '0.7' },
      { loc: '/contact', changefreq: 'monthly', priority: '0.7' },
      { loc: '/categories', changefreq: 'weekly', priority: '0.8' },
      { loc: '/marketplace', changefreq: 'weekly', priority: '0.9' },
      { loc: '/blog', changefreq: 'weekly', priority: '0.8' },
    ];

    const urls = staticUrls.map((item) =>
      sitemapUrl(item.loc, item)
    );

    for (const post of blogResult.data || []) {
      if (!post.slug) continue;

      urls.push(
        sitemapUrl(`/blog/${encodeURIComponent(post.slug)}`, {
          lastmod: post.updated_at || post.published_at,
          changefreq: 'monthly',
          priority: '0.7',
        })
      );
    }

    for (const service of serviceResult.data || []) {
      if (!service.id) continue;

      const serviceSlug = service.slug || service.id;

      urls.push(
        sitemapUrl(`/service/${encodeURIComponent(serviceSlug)}`, {
          lastmod: service.updated_at,
          changefreq: 'monthly',
          priority: '0.8',
        })
      );
    }

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      urls.join('') +
      '</urlset>';

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=3600, stale-while-revalidate=86400'
    );

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    return res.status(200).send(xml);
  } catch (error) {
    console.error('Sitemap generation failed', error);
    return res.status(500).send('Sitemap generation failed');
  }
}
