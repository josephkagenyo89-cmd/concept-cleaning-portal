-- Introduce the authoritative service-category relationship.
-- The legacy services.category text column is deliberately retained.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'services_category_id_fkey'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_category_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES public.service_categories(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_services_category_id
  ON public.services(category_id);

-- Backfill only when the trimmed, case-insensitive category name
-- identifies exactly one row in the authoritative catalogue.
-- Ambiguous and unmatched services remain NULL for manual review.
WITH category_matches AS (
  SELECT
    s.id AS service_id,
    MIN(sc.id::text)::uuid AS matched_category_id
  FROM public.services AS s
  JOIN public.service_categories AS sc
    ON LOWER(BTRIM(s.category)) = LOWER(BTRIM(sc.name))
  WHERE s.category_id IS NULL
  GROUP BY s.id
  HAVING COUNT(DISTINCT sc.id) = 1
)
UPDATE public.services AS s
SET category_id = cm.matched_category_id
FROM category_matches AS cm
WHERE s.id = cm.service_id
  AND s.category_id IS NULL;

COMMENT ON COLUMN public.services.category_id IS
  'Authoritative FK to service_categories.id. Legacy category text retained during migration.';
