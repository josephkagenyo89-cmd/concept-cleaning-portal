const SITE_URL = 'https://www.conceptcleaningservices.co.ke';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const slug = typeof req.query.slug === 'string'
    ? req.query.slug.trim()
    : '';

  if (!slug || slug.length > 200) {
    return res.status(404).send('Service not found');
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Service metadata API: Supabase environment is not configured');
    return res.status(500).send('Unable to generate service page');
  }

  try {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    const params = new URLSearchParams({
      select: 'id,slug,name,short_description,description,is_active,image_url',
      [isUuid ? 'id' : 'slug']: `eq.${slug}`,
      is_active: 'eq.true',
      limit: '1',
    });

    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, '')}/rest/v1/services?${params.toString()}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Service metadata API: service lookup failed', response.status);
      return res.status(502).send('Unable to retrieve service information');
    }

    const rows = await response.json();
    const service = Array.isArray(rows) ? rows[0] : null;

    if (!service || !service.id || !service.name) {
      return res.status(404).send('Service not found');
    }

    const title = `${service.name} | Concept Cleaning Services`;
    const description = String(
      service.short_description ||
      service.description ||
      `Professional ${service.name.toLowerCase()} in Nairobi and surrounding areas. Book Concept Cleaning Services today.`
    ).slice(0, 300);

    const canonicalSlug = service.slug || service.id;
    const canonicalUrl = `${SITE_URL}/service/${encodeURIComponent(canonicalSlug)}`;
    const image = service.image_url || `${SITE_URL}/og-image.png`;

    const serviceSchema = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: service.name,
      description,
      url: canonicalUrl,
      areaServed: [
        { '@type': 'City', name: 'Nairobi' },
        { '@type': 'AdministrativeArea', name: 'Kiambu County' },
        { '@type': 'AdministrativeArea', name: 'Kajiado County' },
        { '@type': 'AdministrativeArea', name: 'Machakos County' },
      ],
      provider: {
        '@type': 'Organization',
        name: 'Concept Cleaning Services',
        url: `${SITE_URL}/`,
        telephone: '+254796563741',
      },
    };

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<script type="application/ld+json">${safeJsonLd(serviceSchema)}</script>
</head>
<body>
<main>
<h1>${escapeHtml(service.name)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${escapeHtml(canonicalUrl)}">View this service on Concept Cleaning Services</a></p>
</main>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    return res.status(200).send(html);
  } catch (error) {
    console.error('Service metadata generation failed', error);
    return res.status(500).send('Unable to generate service page');
  }
}
