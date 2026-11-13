import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.conceptcleaningservices.co.ke';

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function slugify(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function purpose(category) {
  if (category.description?.trim()) return category.description.trim();
  const name = category.name.toLowerCase();
  if (/residential|house|home|domestic/.test(name)) return 'Designed for the regular care and detailed cleaning of living spaces. Explore services that help maintain cleaner rooms, kitchens, bathrooms and household surfaces, with options suited to different home sizes and cleaning needs.';
  if (/commercial|office|business|industrial/.test(name)) return 'For workplaces and business premises that need a clean, orderly and welcoming environment. Explore cleaning options for offices, shared areas and commercial spaces, with service choices based on the property and its day-to-day requirements.';
  if (/upholstery|sofa|furniture/.test(name)) return 'Focused on the fabric and surfaces of upholstered furniture. Explore services for sofas, seats and other soft furnishings to address embedded dust, everyday marks and accumulated dirt while taking the material into account.';
  if (/carpet|rug/.test(name)) return 'For carpets and rugs that collect dust, grit and everyday stains through regular use. Explore suitable cleaning options to refresh floor coverings and improve the cleanliness of the rooms in which they are used.';
  if (/mattress|bed/.test(name)) return 'Focused on the cleaning and care of mattresses and sleeping surfaces. Explore options for addressing accumulated dust, marks and everyday soiling as part of a cleaner, more comfortable bedroom.';
  if (/car|vehicle|auto|detailing/.test(name)) return 'For the interior spaces and surfaces of vehicles. Explore cleaning options for seats, carpets, mats, dashboards and other interior areas, with attention to the materials and surfaces that need care.';
  if (/pest|fumig|cockroach|bedbug|rodent|termite/.test(name)) return 'For properties that need professional pest management. Explore the available inspection, treatment and prevention services for common household or business pest concerns, and choose the option that matches the pest issue and property.';
  return 'Explore the services grouped under ' + category.name + '. This category helps you compare the available options for the relevant space, surface or cleaning requirement, review each service’s details and choose the most suitable next step for your property.';
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : '';
  if (!categoryId) return res.status(404).send('Category not found');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(503).send('Category content is temporarily unavailable');

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const [categoryResult, serviceResult] = await Promise.all([
      supabase.from('service_categories').select('id,name,description,is_active').eq('id', categoryId).eq('is_active', true).maybeSingle(),
      supabase.from('services').select('id,name,slug,short_description,description,category_id').eq('category_id', categoryId).eq('is_active', true).order('name', { ascending: true }),
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (serviceResult.error) throw serviceResult.error;
    const category = categoryResult.data;
    if (!category) return res.status(404).send('Category not found');

    const categorySlug = slugify(category.name);
    const canonicalPath = '/services/category/' + encodeURIComponent(category.id) + '/' + categorySlug;
    const canonical = SITE_URL + canonicalPath;
    const description = purpose(category);
    const title = category.name + ' Services in Nairobi | Concept Cleaning Services';
    const services = serviceResult.data || [];
    const list = services.length
      ? '<div class="grid">' + services.map((service) => {
          const href = '/service/' + encodeURIComponent(service.slug || service.id);
          const summary = service.short_description || service.description || 'View the service details and available booking options.';
          return '<article class="card"><h2><a href="' + href + '">' + escapeHtml(service.name) + '</a></h2><p>' + escapeHtml(summary) + '</p><a href="' + href + '">View service details</a></article>';
        }).join('') + '</div>'
      : '<article class="card"><h2>Services are being updated</h2><p>There are no active services listed in this category at the moment. Contact our team if you need help with this type of service.</p><a href="/contact">Contact our team</a></article>';

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title,
      description,
      url: canonical,
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: services.map((service, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: service.name,
          url: SITE_URL + '/service/' + encodeURIComponent(service.slug || service.id),
        })),
      },
    };

    const html = '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeHtml(title) + '</title><meta name="description" content="' + escapeHtml(description) + '">' +
      '<meta name="robots" content="index,follow,max-image-preview:large"><link rel="canonical" href="' + escapeHtml(canonical) + '">' +
      '<meta property="og:type" content="website"><meta property="og:url" content="' + escapeHtml(canonical) + '"><meta property="og:title" content="' + escapeHtml(title) + '"><meta property="og:description" content="' + escapeHtml(description) + '"><meta property="og:image" content="' + SITE_URL + '/og-image.png">' +
      '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + escapeHtml(title) + '"><meta name="twitter:description" content="' + escapeHtml(description) + '">' +
      '<script type="application/ld+json">' + safeJsonLd(schema) + '</script>' +
      '<style>*{box-sizing:border-box}body{margin:0;font:16px Arial,sans-serif;color:#172033;background:#f8fafc}a{color:#0f766e;text-decoration:none}header,footer{background:#102a2a;color:white;padding:20px}header a,footer a{color:#ccfbf1}.wrap{max-width:1180px;margin:auto}.hero{background:#0b3d3b;color:white;padding:58px 22px}.hero h1{font-size:clamp(32px,5vw,52px);margin:14px 0;line-height:1.1}.hero p{max-width:850px;line-height:1.8;color:#e2e8f0}.content{max-width:1180px;margin:auto;padding:44px 22px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.card{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px}.card h2{font-size:20px}.card p{color:#64748b;line-height:1.7}.back{display:inline-block;margin-top:28px;font-weight:bold}footer{margin-top:45px;color:#cbd5e1}</style></head><body>' +
      '<header><div class="wrap"><a href="/"><strong>CONCEPT CLEANING SERVICES</strong></a><nav style="float:right"><a href="/services">All service categories</a>　<a href="/contact">Contact</a></nav></div></header>' +
      '<main><section class="hero"><div class="wrap"><p>OUR SERVICE CATEGORIES</p><h1>' + escapeHtml(category.name) + '</h1><p>' + escapeHtml(description) + '</p></div></section>' +
      '<section class="content"><h2>Services in this category</h2>' + list + '<a class="back" href="/services">← Browse all categories</a></section></main>' +
      '<footer><div class="wrap">Concept Cleaning Services · Professional cleaning and pest control in Nairobi, Kenya</div></footer></body></html>';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=86400');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error('Category SEO rendering failed:', error);
    return res.status(503).send('Category content is temporarily unavailable');
  }
}
