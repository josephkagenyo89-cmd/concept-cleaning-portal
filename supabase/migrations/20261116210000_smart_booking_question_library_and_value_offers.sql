-- Smart Booking: reusable question templates and administrator-managed value offers.
-- No service/category catalogue data is seeded or mapped by this migration.

CREATE TABLE IF NOT EXISTS public.booking_engine_question_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  input_type text NOT NULL CHECK (input_type IN ('text','textarea','number','boolean','select','multi_select','measurement','date')),
  required_default boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(options) = 'array'),
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(validation_rules) = 'object'),
  prompt_group text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_engine_question_templates_key_format CHECK (question_key ~ '^[a-z][a-z0-9_]{1,79}$')
);

ALTER TABLE public.booking_engine_questions
  ADD COLUMN IF NOT EXISTS question_template_id uuid
    REFERENCES public.booking_engine_question_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS booking_engine_questions_config_template_uidx
  ON public.booking_engine_questions(service_config_id, question_template_id);

DROP POLICY IF EXISTS booking_engine_public_read_questions ON public.booking_engine_questions;
CREATE POLICY booking_engine_public_read_questions
  ON public.booking_engine_questions
  FOR SELECT TO anon, authenticated
  USING (
    active = true
    AND EXISTS (
      SELECT 1
      FROM public.booking_engine_service_config c
      WHERE c.id = booking_engine_questions.service_config_id
        AND c.enabled = true
    )
  );

ALTER TABLE public.booking_engine_question_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS booking_engine_admin_manage_question_templates ON public.booking_engine_question_templates;
CREATE POLICY booking_engine_admin_manage_question_templates
  ON public.booking_engine_question_templates
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS booking_engine_public_read_active_question_templates ON public.booking_engine_question_templates;
CREATE POLICY booking_engine_public_read_active_question_templates
  ON public.booking_engine_question_templates
  FOR SELECT TO anon, authenticated
  USING (active = true);

CREATE TABLE IF NOT EXISTS public.booking_engine_value_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_key text NOT NULL UNIQUE,
  offer_type text NOT NULL CHECK (offer_type IN ('add_on','package','upgrade','recurring')),
  title text NOT NULL,
  description text,
  terms text,
  price_mode text NOT NULL DEFAULT 'quotation'
    CHECK (price_mode IN ('quotation','fixed','percentage_discount','fixed_discount')),
  price_value numeric(12,2),
  currency text NOT NULL DEFAULT 'KES',
  active boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_engine_value_offers_key_format CHECK (offer_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  CONSTRAINT booking_engine_value_offers_price_valid CHECK (
    (price_mode = 'quotation' AND price_value IS NULL)
    OR (price_mode <> 'quotation' AND price_value IS NOT NULL AND price_value >= 0)
  ),
  CONSTRAINT booking_engine_value_offers_dates_valid CHECK (
    starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at
  )
);

CREATE TABLE IF NOT EXISTS public.booking_engine_value_offer_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.booking_engine_value_offers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  relationship text NOT NULL CHECK (relationship IN ('trigger','included','recommended')),
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, service_id, relationship)
);

CREATE INDEX IF NOT EXISTS booking_engine_value_offers_active_dates_idx
  ON public.booking_engine_value_offers(active, starts_at, ends_at, display_order);
CREATE INDEX IF NOT EXISTS booking_engine_value_offer_services_service_idx
  ON public.booking_engine_value_offer_services(service_id, relationship);
CREATE INDEX IF NOT EXISTS booking_engine_value_offer_services_offer_idx
  ON public.booking_engine_value_offer_services(offer_id);

ALTER TABLE public.booking_engine_value_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_engine_value_offer_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_engine_admin_manage_value_offers ON public.booking_engine_value_offers;
CREATE POLICY booking_engine_admin_manage_value_offers
  ON public.booking_engine_value_offers
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS booking_engine_public_read_active_value_offers ON public.booking_engine_value_offers;
CREATE POLICY booking_engine_public_read_active_value_offers
  ON public.booking_engine_value_offers
  FOR SELECT TO anon, authenticated
  USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

DROP POLICY IF EXISTS booking_engine_admin_manage_value_offer_services ON public.booking_engine_value_offer_services;
CREATE POLICY booking_engine_admin_manage_value_offer_services
  ON public.booking_engine_value_offer_services
  FOR ALL TO authenticated
  USING (public.is_admin_or_super(auth.uid()))
  WITH CHECK (public.is_admin_or_super(auth.uid()));

DROP POLICY IF EXISTS booking_engine_public_read_active_value_offer_services ON public.booking_engine_value_offer_services;
CREATE POLICY booking_engine_public_read_active_value_offer_services
  ON public.booking_engine_value_offer_services
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.booking_engine_value_offers o
      WHERE o.id = booking_engine_value_offer_services.offer_id
        AND o.active = true
        AND (o.starts_at IS NULL OR o.starts_at <= now())
        AND (o.ends_at IS NULL OR o.ends_at > now())
    )
  );

-- Reusable, editable prompts only. They are not attached to any service until an administrator applies them.
INSERT INTO public.booking_engine_question_templates
  (question_key, label, description, input_type, required_default, options, validation_rules, prompt_group, display_order)
VALUES
  ('service_quantity', 'How many items or areas need attention?', 'Enter an approximate quantity. Your team can confirm the final scope.', 'number', true, '[]'::jsonb, '{"min":1}'::jsonb, 'quantity', 10),
  ('property_type', 'What type of property is this?', 'Choose the closest match.', 'select', false, '[{"label":"Residential","value":"residential"},{"label":"Commercial","value":"commercial"},{"label":"Other / Not sure","value":"other"}]'::jsonb, '{}'::jsonb, 'property', 20),
  ('property_size_sqm', 'What is the approximate property or area size in square metres?', 'An estimate is fine if you do not know the exact measurement.', 'number', false, '[]'::jsonb, '{"min":0.1}'::jsonb, 'measurements', 30),
  ('bedroom_count', 'How many bedrooms are there?', 'Only answer if relevant to the service.', 'number', false, '[]'::jsonb, '{"min":0}'::jsonb, 'property', 40),
  ('bathroom_count', 'How many bathrooms are there?', 'Only answer if relevant to the service.', 'number', false, '[]'::jsonb, '{"min":0}'::jsonb, 'property', 50),
  ('item_material', 'What material or surface is involved?', 'Choose the closest match, or select not sure.', 'select', false, '[{"label":"Fabric / Textile","value":"fabric"},{"label":"Leather","value":"leather"},{"label":"Wood","value":"wood"},{"label":"Tile / Stone","value":"tile_stone"},{"label":"Glass","value":"glass"},{"label":"Metal","value":"metal"},{"label":"Other / Not sure","value":"other"}]'::jsonb, '{}'::jsonb, 'materials', 60),
  ('condition_level', 'How would you describe the current condition?', 'This helps us understand the level of work required.', 'select', false, '[{"label":"Light","value":"light"},{"label":"Moderate","value":"moderate"},{"label":"Heavy","value":"heavy"},{"label":"Not sure","value":"unknown"}]'::jsonb, '{}'::jsonb, 'condition', 70),
  ('visible_stains', 'Are there visible stains or difficult spots?', 'Select yes if there are areas needing special attention.', 'boolean', false, '[]'::jsonb, '{}'::jsonb, 'condition', 80),
  ('unpleasant_odour', 'Are there persistent or unpleasant odours?', 'This helps us assess any additional treatment that may be needed.', 'boolean', false, '[]'::jsonb, '{}'::jsonb, 'condition', 90),
  ('pest_observed', 'Which pest or issue have you noticed?', 'Describe what you have seen. You can include more than one.', 'textarea', false, '[]'::jsonb, '{}'::jsonb, 'assessment', 100),
  ('problem_extent', 'How widespread is the issue?', 'Choose the closest description.', 'select', false, '[{"label":"One item or area","value":"single_area"},{"label":"Several areas","value":"multiple_areas"},{"label":"Across the property","value":"whole_property"},{"label":"Not sure","value":"unknown"}]'::jsonb, '{}'::jsonb, 'assessment', 110),
  ('service_frequency', 'How often do you need this service?', 'Useful when considering ongoing service arrangements.', 'select', false, '[{"label":"One-time","value":"one_time"},{"label":"Weekly","value":"weekly"},{"label":"Fortnightly","value":"fortnightly"},{"label":"Monthly","value":"monthly"},{"label":"Quarterly","value":"quarterly"},{"label":"Not sure","value":"unknown"}]'::jsonb, '{}'::jsonb, 'frequency', 120),
  ('preferred_timing', 'When would you prefer the service?', 'Choose the option that best matches your timing.', 'select', false, '[{"label":"As soon as possible","value":"asap"},{"label":"Within 7 days","value":"within_7_days"},{"label":"Flexible","value":"flexible"}]'::jsonb, '{}'::jsonb, 'timing', 130),
  ('access_notes', 'Are there any access or parking instructions?', 'Share gate, parking, floor or access details that may help the team.', 'textarea', false, '[]'::jsonb, '{}'::jsonb, 'access', 140),
  ('special_requirements', 'Anything else our team should know?', 'Share special requests or concerns before we prepare your estimate.', 'textarea', false, '[]'::jsonb, '{}'::jsonb, 'additional', 150)
ON CONFLICT (question_key) DO NOTHING;
