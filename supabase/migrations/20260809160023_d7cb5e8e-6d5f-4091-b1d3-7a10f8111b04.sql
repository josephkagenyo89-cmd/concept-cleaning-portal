-- 1. SERVICE CODES ------------------------------------------------------
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS service_code text;

CREATE OR REPLACE FUNCTION public.build_service_code(_name text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  cleaned text;
  parts text[];
  p text;
  initials text := '';
BEGIN
  cleaned := regexp_replace(coalesce(_name, ''), '[^a-zA-Z0-9 ]', ' ', 'g');
  parts := regexp_split_to_array(btrim(cleaned), '\s+');
  FOREACH p IN ARRAY coalesce(parts, ARRAY[]::text[]) LOOP
    IF length(p) > 0 THEN
      initials := initials || upper(substring(p from 1 for 1));
    END IF;
    EXIT WHEN length(initials) >= 4;
  END LOOP;
  IF length(initials) = 0 THEN
    initials := 'SVC';
  END IF;
  RETURN initials;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_service_code(_name text, _exclude_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text := public.build_service_code(_name);
  candidate text := base;
  n int := 1;
BEGIN
  WHILE EXISTS (
    SELECT 1 FROM public.services
    WHERE service_code = candidate
      AND (_exclude_id IS NULL OR id <> _exclude_id)
  ) LOOP
    n := n + 1;
    candidate := base || n::text;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_service_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.service_code IS NULL OR btrim(NEW.service_code) = '' THEN
    NEW.service_code := public.next_service_code(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_service_code ON public.services;
CREATE TRIGGER trg_assign_service_code
BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.assign_service_code();

-- Backfill existing services without codes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, name FROM public.services WHERE service_code IS NULL OR btrim(service_code) = '' ORDER BY created_at LOOP
    UPDATE public.services SET service_code = public.next_service_code(r.name, r.id) WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS services_service_code_key ON public.services (service_code);

-- 2. SERVICE CATEGORIES -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.service_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;
GRANT ALL ON public.service_categories TO service_role;

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view service categories" ON public.service_categories;
CREATE POLICY "Anyone can view service categories"
ON public.service_categories FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage service categories" ON public.service_categories;
CREATE POLICY "Admins can manage service categories"
ON public.service_categories FOR ALL TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP TRIGGER IF EXISTS trg_service_categories_updated ON public.service_categories;
CREATE TRIGGER trg_service_categories_updated
BEFORE UPDATE ON public.service_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed from existing service categories (preserves existing data)
INSERT INTO public.service_categories (name, sort_order)
SELECT DISTINCT s.category, 0 FROM public.services s
WHERE coalesce(btrim(s.category), '') <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.service_categories (name, sort_order) VALUES
  ('Residential Cleaning', 1),
  ('Upholstery Cleaning', 2),
  ('Carpet & Rug Cleaning', 3),
  ('Car Interior Cleaning', 4),
  ('Commercial Cleaning', 5),
  ('Fumigation & Pest Control', 6)
ON CONFLICT (name) DO NOTHING;

-- 3. CERTIFICATE SIGNATURE BYPASS ---------------------------------------
ALTER TABLE public.service_certificates ALTER COLUMN client_signature DROP NOT NULL;
ALTER TABLE public.service_certificates ADD COLUMN IF NOT EXISTS signature_bypassed boolean NOT NULL DEFAULT false;
ALTER TABLE public.service_certificates ADD COLUMN IF NOT EXISTS signature_bypass_reason text;
ALTER TABLE public.service_certificates ADD COLUMN IF NOT EXISTS signature_bypassed_by uuid;
ALTER TABLE public.service_certificates ADD COLUMN IF NOT EXISTS signature_bypassed_by_name text;
ALTER TABLE public.service_certificates ADD COLUMN IF NOT EXISTS signature_bypassed_at timestamptz;