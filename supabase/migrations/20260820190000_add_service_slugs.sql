-- Add SEO-friendly slugs to services
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS slug text;

-- Generate a URL-safe base slug from a service name
CREATE OR REPLACE FUNCTION public.build_service_slug(_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text;
BEGIN
  result := lower(coalesce(_name, ''));

  -- Normalize common multiplication symbols
  result := replace(result, '×', 'x');
  result := replace(result, '–', '-');
  result := replace(result, '—', '-');

  -- Remove anything that isn't a letter, number, space or hyphen
  result := regexp_replace(result, '[^a-z0-9\s-]', '', 'g');

  -- Convert whitespace to hyphens
  result := regexp_replace(result, '\s+', '-', 'g');

  -- Collapse repeated hyphens
  result := regexp_replace(result, '-+', '-', 'g');

  -- Remove leading/trailing hyphens
  result := regexp_replace(result, '^-|-$', '', 'g');

  RETURN result;
END;
$$;


-- Generate a unique slug for a service
CREATE OR REPLACE FUNCTION public.next_service_slug(
  _name text,
  _exclude_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  candidate text;
  n integer := 0;
BEGIN
  base_slug := public.build_service_slug(_name);

  IF base_slug = '' THEN
    base_slug := 'service';
  END IF;

  candidate := base_slug;

  WHILE EXISTS (
    SELECT 1
    FROM public.services
    WHERE slug = candidate
      AND (_exclude_id IS NULL OR id <> _exclude_id)
  ) LOOP
    n := n + 1;
    candidate := base_slug || '-' || n::text;
  END LOOP;

  RETURN candidate;
END;
$$;


-- Automatically assign a slug whenever a service is created
CREATE OR REPLACE FUNCTION public.assign_service_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR btrim(NEW.slug) = '' THEN
    NEW.slug := public.next_service_slug(NEW.name, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_assign_service_slug ON public.services;

CREATE TRIGGER trg_assign_service_slug
BEFORE INSERT ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.assign_service_slug();


-- Backfill existing services
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, name
    FROM public.services
    WHERE slug IS NULL OR btrim(slug) = ''
    ORDER BY created_at, id
  LOOP
    UPDATE public.services
    SET slug = public.next_service_slug(r.name, r.id)
    WHERE id = r.id;
  END LOOP;
END $$;


-- Slugs must be unique
CREATE UNIQUE INDEX IF NOT EXISTS services_slug_key
ON public.services (slug);