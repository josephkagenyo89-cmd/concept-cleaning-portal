-- Add a selectable image key to each service category.
-- Existing categories receive a matching image where possible.

ALTER TABLE public.service_categories
ADD COLUMN IF NOT EXISTS image_key text;

UPDATE public.service_categories
SET image_key = CASE name
  WHEN 'Residential Cleaning' THEN 'residential'
  WHEN 'Upholstery Cleaning' THEN 'upholstery'
  WHEN 'Carpet & Rug Cleaning' THEN 'carpet'
  WHEN 'Car Interior Cleaning' THEN 'car'
  WHEN 'Commercial Cleaning' THEN 'commercial'
  WHEN 'Fumigation & Pest Control' THEN 'pest'
  ELSE 'residential'
END
WHERE image_key IS NULL;

ALTER TABLE public.service_categories
  ALTER COLUMN image_key SET DEFAULT 'residential',
  ALTER COLUMN image_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.service_categories'::regclass
      AND conname = 'service_categories_image_key_check'
  ) THEN
    ALTER TABLE public.service_categories
      ADD CONSTRAINT service_categories_image_key_check
      CHECK (
        image_key IN (
          'residential',
          'upholstery',
          'carpet',
          'car',
          'commercial',
          'pest',
          'monthly-offers'
        )
      );
  END IF;
END
$$;
