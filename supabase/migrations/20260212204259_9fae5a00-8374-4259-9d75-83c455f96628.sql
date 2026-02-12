
-- Add category, pricing_model, and commission_eligible to services
ALTER TABLE public.services ADD COLUMN category text NOT NULL DEFAULT 'Cleaning Services';
ALTER TABLE public.services ADD COLUMN pricing_model text NOT NULL DEFAULT 'fixed';
ALTER TABLE public.services ADD COLUMN commission_eligible boolean NOT NULL DEFAULT true;

-- Add check constraint for pricing_model values
ALTER TABLE public.services ADD CONSTRAINT services_pricing_model_check CHECK (pricing_model IN ('fixed', 'variation', 'per_unit'));
