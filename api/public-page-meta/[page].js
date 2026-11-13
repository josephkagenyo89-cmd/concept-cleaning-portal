import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.conceptcleaningservices.co.ke';
const DEFAULT_PHONE = '+254796563741';
const DEFAULT_EMAIL = 'info@conceptcleaning.co.ke';
const AREAS = ['Nairobi', 'Kiambu', 'Kajiado', 'Machakos'];
const PRIORITY_AREAS = ['Westlands', 'Kilimani', 'Karen', 'Lavington', 'Runda', 'Ruaka', 'Ruiru', 'Thika', 'Kitengela', 'Ongata Rongai'];

const PAGE_META = {
  services: {
    title: 'Cleaning Services in Nairobi | Concept Cleaning Services',
    description: 'Explore professional residential, commercial, upholstery, carpet, car interior cleaning, fumigation and pest-control services in Nairobi and surrounding areas.',
    heading: 'Professional cleaning and pest-control services in Nairobi',
    intro: 'Explore the services available from Concept Cleaning Services. Browse the catalogue by category, review each service’s details and follow its page to see the available booking options.',
    type: 'CollectionPage',
  },
  about: {
    title: 'About Concept Cleaning Services | Nairobi, Kenya',
    description: 'Learn about Concept Cleaning Services, our professional cleaning approach, service standards and residential and commercial cleaning solutions in Nairobi.',
    heading: 'Professional care for the spaces where life and business happen',
    intro: 'Concept Cleaning Services provides cleaning and pest-control services for residential and commercial properties in Nairobi and surrounding areas.',
    type: 'AboutPage',
  },
  gallery: {
    title: 'Cleaning Projects & Gallery | Concept Cleaning Services Nairobi',
    description: 'Explore cleaning project photographs from Concept Cleaning Services, including residential, upholstery, carpet and specialist cleaning work.',
    heading: 'A closer look at our cleaning work',
    intro: 'Browse photographs attached to our service records. Each image is shown with its related service so you can explore the work and find the right service for your property.',
    type: 'CollectionPage',
  },
  contact: {
    title: 'Contact Concept Cleaning Services | Nairobi',
    description: 'Contact Concept Cleaning Services to arrange professional home, office, upholstery and pest-control services in Nairobi and surrounding areas.',
    heading: 'Let’s discuss the cleaning service you need',
    intro: 'Get in touch with Concept Cleaning Services to ask about available services, arrange a booking or request guidance on the right option for your property.',
    type: 'ContactPage',
  },
};

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

function safeImageUrl(value) {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) || url.startsWith('/') ? url : '';
}

function galleryEntries(value, serviceName) {
  let entries = [];
  if (Array.isArray(value)) entries = value;
  else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      entries = [value];
    }
  } else if (value && typeof value === 'object') entries = Object.values(value);

  return entries.flatMap((entry) => {
    const record = typeof entry === 'string' ? { url: entry } : (entry && typeof entry === 'object' ? entry : {});
    const url = safeImageUrl(record.url || record.src || record.image_url);
    if (!url) return [];
    return [{
      url,
      alt: String(record.alt || record.title || (serviceName + ' cleaning project')),
      serviceName,
    }];
  });
}

function navLink(path, label, active) {
  const current = active === path ? ' aria-current="page"' : '';
  const style = active === path ? ' class="active"' : '';
  return '<a href="' + path + '"' + style + current + '>' + label + '</a>';
}

function pageShell(page, body, settings) {
  const company = escapeHtml(settings.company_name || 'Concept Cleaning Services');
  const phone = String(settings.phone || DEFAULT_PHONE);
  const email = String(settings.email || DEFAULT_EMAIL);
  const address = escapeHtml(settings.address || 'Nairobi, Kenya');
  const phoneDigits = phone.replace(/[^0-9]/g, '');
  const whatsapp = 'https://wa.me/' + phoneDigits + '?text=' + encodeURIComponent('Hello Concept Cleaning Services, I would like to enquire about your services.');
  const canonical = SITE_URL + '/' + page;
  const nav = [
    navLink('/', 'Home', page),
    navLink('/services', 'Services', page),
    navLink('/about', 'About Us', page),
    navLink('/gallery', 'Gallery', page),
    navLink('/contact', 'Contact', page),
  ].join('');

  const schema = {
    '@context': 'https://schema.org',
    '@type': PAGE_META[page].type,
    name: PAGE_META[page].title,
    description: PAGE_META[page].description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Concept Cleaning Services', url: SITE_URL + '/' },
    about: {
      '@type': 'Organization',
      name: company,
      url: SITE_URL + '/',
      telephone: phone,
      email,
      address: { '@type': 'PostalAddress', addressLocality: settings.address || 'Nairobi', addressCountry: 'KE' },
      areaServed: AREAS.map((name) => ({ '@type': 'AdministrativeArea', name })),
    },
  };

  return '<!doctype html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml(PAGE_META[page].title) + '</title>' +
    '<meta name="description" content="' + escapeHtml(PAGE_META[page].description) + '">' +
    '<meta name="robots" content="index,follow,max-image-preview:large">' +
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">' +
    '<meta property="og:type" content="website"><meta property="og:url" content="' + escapeHtml(canonical) + '">' +
    '<meta property="og:title" content="' + escapeHtml(PAGE_META[page].title) + '">' +
    '<meta property="og:description" content="' + escapeHtml(PAGE_META[page].description) + '">' +
    '<meta property="og:image" content="' + SITE_URL + '/og-image.png">' +
    '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="' + escapeHtml(PAGE_META[page].title) + '">' +
    '<meta name="twitter:description" content="' + escapeHtml(PAGE_META[page].description) + '"><meta name="twitter:image" content="' + SITE_URL + '/og-image.png">' +
    '<script type="application/ld+json">' + safeJsonLd(schema) + '</script>' +
    '<style>' +
    ':root{font-family:Arial,Helvetica,sans-serif;color:#172033;background:#f8fafc}*{box-sizing:border-box}body{margin:0}a{color:#0f766e;text-decoration:none}a:hover{text-decoration:underline}' +
    'header{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #e2e8f0}nav{max-width:1180px;margin:auto;padding:16px 22px;display:flex;align-items:center;gap:24px;flex-wrap:wrap}' +
    'nav .brand{font-weight:900;color:#102a2a;margin-right:auto}nav a{font-size:14px;font-weight:700;color:#475569}nav a.active{color:#0f766e}' +
    '.hero{background:#0b3d3b;color:#fff;padding:64px 22px}.wrap{max-width:1180px;margin:auto}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#99f6e4}' +
    'h1{font-size:clamp(32px,5vw,52px);line-height:1.1;max-width:900px;margin:16px 0}h2{font-size:26px;line-height:1.2;margin:0 0 12px}h3{font-size:18px;margin:0 0 8px}p{line-height:1.75}.hero p{max-width:820px;color:#e2e8f0}' +
    'main{min-height:65vh}.content{max-width:1180px;margin:auto;padding:48px 22px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px}.card img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;margin-bottom:14px}.muted{color:#64748b}.tag{font-size:12px;font-weight:800;color:#0f766e;text-transform:uppercase;letter-spacing:.12em}.group{margin:0 0 44px}.cta{background:#0f766e;color:#fff;border-radius:22px;padding:28px;margin-top:34px}.cta a{display:inline-block;background:#fff;color:#115e59;padding:12px 18px;border-radius:8px;font-weight:800;margin-top:8px}' +
    'footer{background:#102a2a;color:#fff;padding:34px 22px;margin-top:56px}footer .wrap{display:flex;gap:36px;justify-content:space-between;flex-wrap:wrap}footer a{color:#ccfbf1}footer p{color:#cbd5e1}@media(max-width:680px){nav{gap:12px;padding:13px 16px}nav .brand{width:100%}.hero{padding:48px 18px}.content{padding:36px 18px}footer .wrap{display:block}}' +
    '</style></head><body><header><nav aria-label="Main navigation"><a class="brand" href="/">' + company + '</a>' + nav + '</nav></header>' +
    '<main>' + body + '</main><footer><div class="wrap"><div><strong>' + company + '</strong><p>Professional cleaning and pest-control services in Nairobi and surrounding areas.</p></div>' +
    '<div><strong>Contact</strong><p><a href="tel:' + escapeHtml(phone) + '">' + escapeHtml(phone) + '</a><br><a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a><br>' + address + '</p><a href="' + escapeHtml(whatsapp) + '">Contact us on WhatsApp</a></div></div></footer></body></html>';
}

async function loadGeneralSettings(supabase) {
  const { data, error } = await supabase.from('system_settings').select('value').eq('category', 'general').maybeSingle();
  if (error) console.warn('Public page SEO: general settings could not be loaded', error.message);
  return data?.value && typeof data.value === 'object' ? data.value : {};
}

async function renderServices(supabase) {
  const [categoryResult, serviceResult] = await Promise.all([
    supabase.from('service_categories').select('id,name,description,sort_order,is_active').eq('is_active', true).order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('services').select('id,name,slug,short_description,description,category_id').eq('is_active', true).order('name', { ascending: true }),
  ]);

  if (categoryResult.error) throw categoryResult.error;
  if (serviceResult.error) throw serviceResult.error;

  const categories = categoryResult.data || [];
  const services = serviceResult.data || [];
  const groups = categories.map((category) => ({
    category,
    services: services.filter((service) => service.category_id === category.id),
  })).filter((group) => group.services.length > 0);
  const unassigned = services.filter((service) => !service.category_id || !categories.some((category) => category.id === service.category_id));

  const renderCard = (service) => {
    const href = '/service/' + encodeURIComponent(service.slug || service.id);
    const summary = service.short_description || service.description || 'View the service description and available booking options.';
    return '<article class="card"><h3><a href="' + href + '">' + escapeHtml(service.name) + '</a></h3><p class="muted">' + escapeHtml(summary) + '</p><a href="' + href + '">View service →</a></article>';
  };

  const categoryHtml = groups.map(({ category, services: categoryServices }) =>
    '<section class="group"><p class="tag">' + categoryServices.length + ' ' + (categoryServices.length === 1 ? 'service' : 'services') + '</p><h2>' + escapeHtml(category.name) + '</h2>' +
    (category.description ? '<p class="muted">' + escapeHtml(category.description) + '</p>' : '') +
    '<div class="grid">' + categoryServices.map(renderCard).join('') + '</div></section>'
  ).join('');

  const unassignedHtml = unassigned.length
    ? '<section class="group"><h2>Other available services</h2><p class="muted">These active services are not currently assigned to an active category.</p><div class="grid">' + unassigned.map(renderCard).join('') + '</div></section>'
    : '';

  return '<section class="hero"><div class="wrap"><p class="eyebrow">Our services</p><h1>' + escapeHtml(PAGE_META.services.heading) + '</h1><p>' + escapeHtml(PAGE_META.services.intro) + '</p></div></section>' +
    '<section class="content"><p class="tag">Browse the catalogue</p><h2>Services available to book</h2><p class="muted">The catalogue below is loaded from the active services and official service categories configured for the website.</p>' +
    categoryHtml + unassignedHtml + '<div class="cta"><h2>Need help choosing a service?</h2><p>Contact our team if you need help selecting the right cleaning or pest-control service.</p><a href="/contact">Contact Concept Cleaning Services</a></div></section>';
}

async function renderGallery(supabase) {
  const { data, error } = await supabase.from('services').select('name,gallery_images').eq('is_active', true).order('name', { ascending: true });
  if (error) throw error;

  const images = (data || []).flatMap((service) => galleryEntries(service.gallery_images, service.name));
  const content = images.length
    ? '<div class="grid">' + images.map((image) =>
      '<figure class="card"><img src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(image.alt) + '" loading="lazy"><figcaption><strong>' + escapeHtml(image.serviceName) + '</strong><p class="muted">' + escapeHtml(image.alt) + '</p></figcaption></figure>'
    ).join('') + '</div>'
    : '<div class="card"><h2>Project photographs are being added</h2><p class="muted">The existing active service records do not currently contain gallery photographs available for this page. Explore the service catalogue to learn about the work we offer.</p><a href="/services">Explore services →</a></div>';

  return '<section class="hero"><div class="wrap"><p class="eyebrow">Our gallery</p><h1>' + escapeHtml(PAGE_META.gallery.heading) + '</h1><p>' + escapeHtml(PAGE_META.gallery.intro) + '</p></div></section>' +
    '<section class="content"><p class="tag">Existing service gallery</p><h2>Project photographs</h2><p class="muted">Images are sourced from photographs attached to active service records.</p>' + content + '</section>';
}

function renderAbout() {
  return '<section class="hero"><div class="wrap"><p class="eyebrow">About Concept Cleaning Services</p><h1>' + escapeHtml(PAGE_META.about.heading) + '</h1><p>' + escapeHtml(PAGE_META.about.intro) + '</p></div></section>' +
    '<section class="content"><p class="tag">Who we are</p><h2>A considered approach to cleaning and property care</h2>' +
    '<p>Concept Cleaning Services brings together residential cleaning, commercial cleaning, specialist upholstery and carpet care, car interior detailing, fumigation and pest-control services.</p>' +
    '<p>Our approach is to understand the space and the service required, explain the available service information and help customers choose an appropriate booking or quotation option.</p>' +
    '<p>We serve customers in Nairobi and confirmed surrounding service areas in Kiambu, Kajiado and Machakos counties.</p>' +
    '<div class="grid"><article class="card"><h3>Understand the requirement</h3><p class="muted">Identify the property, space and type of cleaning or pest-control service needed.</p></article>' +
    '<article class="card"><h3>Review the service details</h3><p class="muted">Use the service catalogue to check descriptions, listed features and available booking information.</p></article>' +
    '<article class="card"><h3>Arrange the next step</h3><p class="muted">Submit a booking request or contact the team if you need help selecting a service.</p></article></div>' +
    '<div class="cta"><h2>Where we serve</h2><p>Nairobi and selected areas in Kiambu, Kajiado and Machakos. Availability depends on the service and exact property location.</p><a href="/contact">Contact our team</a></div></section>';
}

function renderContact(settings) {
  const phone = String(settings.phone || DEFAULT_PHONE);
  const email = String(settings.email || DEFAULT_EMAIL);
  const address = String(settings.address || 'Nairobi, Kenya');
  const phoneDigits = phone.replace(/[^0-9]/g, '');
  const whatsapp = 'https://wa.me/' + phoneDigits + '?text=' + encodeURIComponent('Hello Concept Cleaning Services, I would like to enquire about a cleaning or pest-control service.');
  const areaItems = PRIORITY_AREAS.map((area) => '<li>' + escapeHtml(area) + '</li>').join('');

  return '<section class="hero"><div class="wrap"><p class="eyebrow">Contact our team</p><h1>' + escapeHtml(PAGE_META.contact.heading) + '</h1><p>' + escapeHtml(PAGE_META.contact.intro) + '</p></div></section>' +
    '<section class="content"><div class="grid"><article class="card"><h2>Contact details</h2><p><strong>Phone:</strong> <a href="tel:' + escapeHtml(phone) + '">' + escapeHtml(phone) + '</a></p>' +
    '<p><strong>WhatsApp:</strong> <a href="' + escapeHtml(whatsapp) + '">Send an enquiry</a></p><p><strong>Email:</strong> <a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a></p>' +
    '<p><strong>Service base:</strong> ' + escapeHtml(address) + '</p><p class="muted">You can also browse the service catalogue and submit a booking request online.</p><a href="/marketplace">Start a booking →</a></article>' +
    '<article class="card"><h2>Nairobi and surrounding areas</h2><p class="muted">Our service coverage includes Nairobi and selected parts of Kiambu, Kajiado and Machakos. Availability depends on the service and exact location.</p><ul>' + areaItems + '</ul></article></div></section>';
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).send('Method not allowed');
  }

  const page = typeof req.query.page === 'string' ? req.query.page.trim().toLowerCase() : '';
  if (!Object.prototype.hasOwnProperty.call(PAGE_META, page)) return res.status(404).send('Page not found');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Public page SEO: Supabase environment is not configured');
    return res.status(503).send('Public page content is temporarily unavailable');
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
    const settings = await loadGeneralSettings(supabase);
    let body = '';
    if (page === 'services') body = await renderServices(supabase);
    else if (page === 'about') body = renderAbout();
    else if (page === 'gallery') body = await renderGallery(supabase);
    else body = renderContact(settings);

    const html = pageShell(page, body, settings);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=86400');
    if (req.method === 'HEAD') return res.status(200).end();
    return res.status(200).send(html);
  } catch (error) {
    console.error('Public page SEO rendering failed:', error);
    return res.status(503).send('Public page content is temporarily unavailable');
  }
}
