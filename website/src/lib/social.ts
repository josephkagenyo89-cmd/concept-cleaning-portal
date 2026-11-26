export const SITE_URL = "https://concept-cleaning-kenya.lovable.app";

export const BLOG_CATEGORIES = [
  "Cleaning Tips",
  "Pest Control Education",
  "Before & After Projects",
  "Car Detailing",
  "Upholstery Cleaning",
  "Product Guides",
] as const;

export const buildSocialCaption = (title: string, excerpt: string | null, slug: string) => {
  const link = `${SITE_URL}/blog/${slug}`;
  return `🧼 ${title}

${excerpt ?? ""}

📍 Serving Nairobi, Kiambu, Kajiado & Machakos

📲 Book via WhatsApp today

🔗 Read more:
${link}`;
};

const toTag = (s: string) =>
  "#" +
  s
    .replace(/&/g, "And")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");

export const buildHashtags = (opts: {
  title: string;
  category?: string | null;
  keywords?: string | null;
}) => {
  const base = [
    "#ConceptCleaningServices",
    "#CleaningServicesNairobi",
    "#CleaningKenya",
    "#Nairobi",
  ];
  const tags = new Set(base);
  if (opts.category) tags.add(toTag(opts.category));
  // Pull notable words from title
  opts.title
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 3)
    .forEach((w) => tags.add(toTag(w)));
  if (opts.keywords) {
    opts.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 5)
      .forEach((k) => tags.add(toTag(k)));
  }
  return Array.from(tags).join(" ");
};
