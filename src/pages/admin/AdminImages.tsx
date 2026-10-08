import { useEffect, useState } from 'react';
import { fetchServiceCategories, FALLBACK_CATEGORIES } from '@/lib/serviceCategories';
import { categoryImage } from '@/lib/marketplace';

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export default function AdminImages() {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const names = await fetchServiceCategories(true).then((c) => c.map((x) => x.name));
        setCategories(names.length ? names : FALLBACK_CATEGORIES);
      } catch (e) {
        setCategories(FALLBACK_CATEGORIES);
      }
    })();
  }, []);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold">Category Images</h1>
        <p className="text-sm text-muted-foreground">
          Marketplace artwork is intentionally served from the bundled local fallback set. Storage-backed uploads have been removed to keep the site stable.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((cat) => {
          const image = categoryImage(cat);
          const slug = slugify(cat);

          return (
            <div key={cat} className="rounded border bg-card p-3 flex items-center gap-4">
              <div className="w-24 h-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                <img src={image} alt={cat} className="w-full h-full object-cover" />
              </div>

              <div className="flex-1">
                <div className="font-medium">{cat}</div>
                <div className="text-xs text-muted-foreground">Local fallback image: {slug}.jpg</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
