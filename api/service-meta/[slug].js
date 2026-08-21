export default async function handler(req, res) {
  const { slug } = req.query;

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slug);
    const column = isUuid ? 'id' : 'slug';

    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/services?select=*&${column}=eq.${encodeURIComponent(slug)}&is_active=eq.true`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const rows = await resp.json();
    const service = rows && rows[0];

    if (!service) {
      res.status(404).send('Service not found');
      return;
    }

    const title = `${service.name} | Concept Cleaning Services`;
    const description =
      service.short_description ||
      service.description ||
      `Professional ${service.name.toLowerCase()} in Nairobi and surrounding areas. Book Concept Cleaning Services today.`;
    const canonicalSlug = service.slug || service.id;
    const url = `https://www.conceptcleaningservices.co.ke/service/${canonicalSlug}`;
    const image = 'https://www.conceptcleaningservices.co.ke/og-image.png';

    const escape = (str) =>
      String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}" />
<link rel="canonical" href="${escape(url)}" />
<meta property="og:title" content="${escape(title)}" />
<meta property="og:description" content="${escape(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escape(url)}" />
<meta property="og:image" content="${escape(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${escape(image)}" />
<meta http-equiv="refresh" content="0; url=${escape(url)}" />
</head>
<body>
<p>${escape(service.name)} &mdash; <a href="${escape(url)}">${escape(url)}</a></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(html);
  } catch (e) {
    res.status(500).send('Error generating meta page');
  }
}
