import { useCallback, useEffect, useState } from 'react';
import {
  fetchServiceCategories,
  type ServiceCategory,
} from '@/lib/serviceCategories';
import { categoryImage } from '@/lib/marketplace';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export default function AdminImages() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchServiceCategories(true);

      if (result.error || !result.data) {
        setCategories([]);
        setError(
          result.error?.message || 'Could not load categories from the database.',
        );
        return;
      }

      setCategories(result.data);
    } catch (err) {
      setCategories([]);
      setError(
        err instanceof Error ? err.message : 'Could not load categories.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-bold">Category Images</h1>
        <p className="text-sm text-muted-foreground">
          Marketplace artwork is served from the bundled image library.
          Category names and image assignments are loaded from the database.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading categories…
        </div>
      ) : error ? (
        <div className="space-y-3 rounded-lg border border-destructive/30 p-4">
          <p className="font-medium text-destructive">
            Categories could not be loaded.
          </p>
          <p className="break-words text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => void loadCategories()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : categories.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground">
          No active categories were found in the database.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {categories.map((cat) => {
            const image = categoryImage(cat.name, cat.image_key);
            const slug = slugify(cat.name);

            return (
              <div
                key={cat.id}
                className="flex items-center gap-4 rounded border bg-card p-3"
              >
                <div className="h-16 w-24 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                  <img
                    src={image}
                    alt={cat.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex-1">
                  <div className="font-medium">{cat.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Image key: {cat.image_key} · {slug}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
