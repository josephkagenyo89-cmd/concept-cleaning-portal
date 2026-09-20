-- CONCEPT CLEANING SERVICES
-- BOOKING ENGINE - DATABASE FOUNDATION
-- ============================================================
-- This migration creates NEW Booking Engine objects only.
-- Existing ERP tables, triggers, functions and workflows
-- are intentionally not modified.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Booking Engine request status
-- ------------------------------------------------------------

CREATE TYPE public.booking_engine_request_status AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'awaiting_customer',
  'approved',
  'quote_required',
  'quote_prepared',
  'customer_accepted',
  'ready_for_booking',
  'converted',
  'rejected',
  'cancelled'
);

-- ------------------------------------------------------------
-- 2. Booking Engine request number sequence
-- ------------------------------------------------------------

CREATE SEQUENCE public.booking_engine_request_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

-- ------------------------------------------------------------
-- 3. Request number generator
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.next_booking_engine_request_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'BE'
    || EXTRACT(YEAR FROM now())::text
    || LPAD(
         nextval('public.booking_engine_request_seq')::text,
         5,
         '0'
       );
$$;

REVOKE ALL
ON FUNCTION public.next_booking_engine_request_number()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.next_booking_engine_request_number()
TO authenticated;

-- 4. Booking Engine service configuration
-- ------------------------------------------------------------

CREATE TABLE public.booking_engine_service_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL
    REFERENCES public.services(id)
    ON DELETE RESTRICT
    UNIQUE,

  enabled BOOLEAN NOT NULL DEFAULT false,

  customer_instructions TEXT,

  photo_mode TEXT NOT NULL DEFAULT 'none'
    CHECK (photo_mode IN ('none', 'optional', 'required')),

  photo_min INTEGER NOT NULL DEFAULT 0
    CHECK (photo_min >= 0),

  photo_max INTEGER NOT NULL DEFAULT 0
    CHECK (photo_max >= 0),

  measurement_config JSONB NOT NULL DEFAULT '{}'::jsonb,

  availability_config JSONB NOT NULL DEFAULT '{}'::jsonb,

  config_version INTEGER NOT NULL DEFAULT 1
    CHECK (config_version > 0),

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT booking_engine_service_config_photo_range_check
    CHECK (photo_min <= photo_max),

  CONSTRAINT booking_engine_service_config_photo_mode_check
    CHECK (
      (photo_mode = 'none' AND photo_min = 0 AND photo_max = 0)
      OR
      (photo_mode IN ('optional', 'required') AND photo_max > 0)
    )
);

CREATE INDEX idx_booking_engine_service_config_enabled
  ON public.booking_engine_service_config(enabled);

ALTER TABLE public.booking_engine_service_config ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 5. Booking Engine service questions
-- ------------------------------------------------------------

CREATE TABLE public.booking_engine_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  service_config_id UUID NOT NULL
    REFERENCES public.booking_engine_service_config(id)
    ON DELETE CASCADE,

  question_key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,

  input_type TEXT NOT NULL
    CHECK (
      input_type IN (
        'text',
        'number',
        'select',
        'multi_select',
        'boolean',
        'date',
        'time',
        'measurement',
        'address'
      )
    ),

  required BOOLEAN NOT NULL DEFAULT false,

  display_order INTEGER NOT NULL DEFAULT 0,

  options JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT booking_engine_questions_key_unique
    UNIQUE (service_config_id, question_key)
);

CREATE INDEX idx_booking_engine_questions_service_config
  ON public.booking_engine_questions(service_config_id);

CREATE INDEX idx_booking_engine_questions_display_order
  ON public.booking_engine_questions(service_config_id, display_order);

ALTER TABLE public.booking_engine_questions ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 6. Booking Engine question conditions
-- ------------------------------------------------------------

CREATE TABLE public.booking_engine_question_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  question_id UUID NOT NULL
    REFERENCES public.booking_engine_questions(id)
    ON DELETE CASCADE,

  depends_on_question_id UUID NOT NULL
    REFERENCES public.booking_engine_questions(id)
    ON DELETE CASCADE,

  operator TEXT NOT NULL
    CHECK (
      operator IN (
        'equals',
        'not_equals',
        'greater_than',
        'less_than',
        'contains'
      )
    ),

  expected_value JSONB NOT NULL,

  action TEXT NOT NULL
    CHECK (
      action IN (
        'show',
        'hide',
        'required',
        'optional'
      )
    ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT booking_engine_question_condition_self_check
    CHECK (question_id <> depends_on_question_id)
);

CREATE INDEX idx_booking_engine_question_conditions_question
  ON public.booking_engine_question_conditions(question_id);

CREATE INDEX idx_booking_engine_question_conditions_dependency
  ON public.booking_engine_question_conditions(depends_on_question_id);

ALTER TABLE public.booking_engine_question_conditions ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 7. Booking Engine pricing rules
-- ------------------------------------------------------------

CREATE TABLE public.booking_engine_pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  service_config_id UUID NOT NULL
    REFERENCES public.booking_engine_service_config(id)
    ON DELETE CASCADE,

  pricing_type TEXT NOT NULL
    CHECK (
      pricing_type IN (
        'fixed',
        'per_unit',
        'per_measurement',
        'tiered',
        'quotation'
      )
    ),

  unit_key TEXT,

  rate NUMERIC(12,2),
  minimum_quantity NUMERIC(12,2),
  maximum_quantity NUMERIC(12,2),

  currency TEXT NOT NULL DEFAULT 'KES',

  version INTEGER NOT NULL DEFAULT 1
    CHECK (version > 0),

  active BOOLEAN NOT NULL DEFAULT true,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT booking_engine_pricing_rules_rate_check
    CHECK (
      pricing_type = 'quotation'
      OR rate IS NOT NULL
    ),

  CONSTRAINT booking_engine_pricing_rules_quantity_range_check
    CHECK (
      maximum_quantity IS NULL
      OR minimum_quantity IS NULL
      OR minimum_quantity <= maximum_quantity
    )
);

CREATE INDEX idx_booking_engine_pricing_rules_service
  ON public.booking_engine_pricing_rules(service_config_id);

CREATE INDEX idx_booking_engine_pricing_rules_active
  ON public.booking_engine_pricing_rules(service_config_id, active);

ALTER TABLE public.booking_engine_pricing_rules ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 8. Booking Engine requests
-- ------------------------------------------------------------

CREATE TABLE public.booking_engine_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  request_number TEXT NOT NULL
    UNIQUE
    DEFAULT public.next_booking_engine_request_number(),

  customer_id UUID
    REFERENCES public.clients(id)
    ON DELETE SET NULL,

  customer_user_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  status public.booking_engine_request_status NOT NULL
    DEFAULT 'draft',

  requested_date DATE,
  requested_time TIME,

  service_location TEXT,
  customer_notes TEXT,

  customer_acknowledged_scope BOOLEAN NOT NULL DEFAULT false,
  scope_acknowledged_at TIMESTAMPTZ,

  converted_booking_id UUID
    REFERENCES public.bookings(id)
    ON DELETE SET NULL,

  submitted_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_engine_requests_customer
  ON public.booking_engine_requests(customer_id);

CREATE INDEX idx_booking_engine_requests_customer_user
  ON public.booking_engine_requests(customer_user_id);

CREATE INDEX idx_booking_engine_requests_status
  ON public.booking_engine_requests(status);

CREATE INDEX idx_booking_engine_requests_created_at
  ON public.booking_engine_requests(created_at DESC);

CREATE INDEX idx_booking_engine_requests_converted_booking
  ON public.booking_engine_requests(converted_booking_id);

ALTER TABLE public.booking_engine_requests ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 9. Booking Engine request service items
-- ------------------------------------------------------------

CREATE TABLE public.booking_engine_request_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  request_id UUID NOT NULL
    REFERENCES public.booking_engine_requests(id)
    ON DELETE CASCADE,

  service_id UUID NOT NULL
    REFERENCES public.services(id)
    ON DELETE RESTRICT,

  service_config_id UUID
    REFERENCES public.booking_engine_service_config(id)
    ON DELETE SET NULL,

  display_order INTEGER NOT NULL DEFAULT 0,

  quantity NUMERIC(12,2),

  measurements JSONB NOT NULL DEFAULT '{}'::jsonb,

  answers JSONB NOT NULL DEFAULT '{}'::jsonb,

  selected_extras JSONB NOT NULL DEFAULT '[]'::jsonb,

  pricing_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

  scope_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

  service_config_version INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_engine_request_items_request
  ON public.booking_engine_request_items(request_id);

CREATE INDEX idx_booking_engine_request_items_service
  ON public.booking_engine_request_items(service_id);

CREATE INDEX idx_booking_engine_request_items_order
  ON public.booking_engine_request_items(request_id, display_order);

ALTER TABLE public.booking_engine_request_items ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 10. Booking Engine request timeline
-- ------------------------------------------------------------

CREATE TABLE public.booking_engine_request_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  request_id UUID NOT NULL
    REFERENCES public.booking_engine_requests(id)
    ON DELETE CASCADE,

  event_type TEXT NOT NULL
    CHECK (
      event_type IN (
        'created',
        'submitted',
        'under_review',
        'information_requested',
        'customer_responded',
        'approved',
        'quote_required',
        'quote_prepared',
        'customer_accepted',
        'ready_for_booking',
        'converted',
        'rejected',
        'cancelled'
      )
    ),

  from_status public.booking_engine_request_status,
  to_status public.booking_engine_request_status,

  message TEXT,

  actor_user_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL,

  actor_name TEXT,
  actor_role TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_engine_request_events_request
  ON public.booking_engine_request_events(request_id);

CREATE INDEX idx_booking_engine_request_events_created_at
  ON public.booking_engine_request_events(request_id, created_at);

ALTER TABLE public.booking_engine_request_events ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 11. Booking Engine service scope
-- ------------------------------------------------------------

CREATE TABLE public.booking_engine_service_scope (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  service_config_id UUID NOT NULL
    REFERENCES public.booking_engine_service_config(id)
    ON DELETE CASCADE,

  scope_type TEXT NOT NULL
    CHECK (
      scope_type IN (
        'included',
        'excluded',
        'extra'
      )
    ),

  title TEXT NOT NULL,
  description TEXT,

  display_order INTEGER NOT NULL DEFAULT 0,

  active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_engine_service_scope_config
  ON public.booking_engine_service_scope(service_config_id);

CREATE INDEX idx_booking_engine_service_scope_order
  ON public.booking_engine_service_scope(
    service_config_id,
    scope_type,
    display_order
  );

ALTER TABLE public.booking_engine_service_scope ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 12. Booking Engine request photos
-- ------------------------------------------------------------

CREATE TABLE public.booking_engine_request_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  request_id UUID NOT NULL
    REFERENCES public.booking_engine_requests(id)
    ON DELETE CASCADE,

  request_item_id UUID
    REFERENCES public.booking_engine_request_items(id)
    ON DELETE CASCADE,

  storage_path TEXT NOT NULL,

  photo_category TEXT NOT NULL
    CHECK (
      photo_category IN (
        'overall_area',
        'problem_area',
        'stain',
        'damage',
        'pest_evidence',
        'measurement',
        'other'
      )
    ),

  original_filename TEXT,

  mime_type TEXT NOT NULL,

  file_size_bytes INTEGER NOT NULL
    CHECK (file_size_bytes > 0),

  width INTEGER,
  height INTEGER,

  display_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_engine_request_photos_request
  ON public.booking_engine_request_photos(request_id);

CREATE INDEX idx_booking_engine_request_photos_item
  ON public.booking_engine_request_photos(request_item_id);

CREATE INDEX idx_booking_engine_request_photos_category
  ON public.booking_engine_request_photos(
    request_id,
    photo_category
  );

ALTER TABLE public.booking_engine_request_photos ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------
-- 13. Booking Engine request submission idempotency
-- ------------------------------------------------------------

ALTER TABLE public.booking_engine_requests
  ADD COLUMN submission_key UUID;

CREATE UNIQUE INDEX idx_booking_engine_requests_submission_key
  ON public.booking_engine_requests(submission_key)
  WHERE submission_key IS NOT NULL;


-- ------------------------------------------------------------
-- 14. Booking Engine automatic updated_at
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.booking_engine_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_engine_service_config_updated_at
BEFORE UPDATE ON public.booking_engine_service_config
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_set_updated_at();

CREATE TRIGGER trg_booking_engine_questions_updated_at
BEFORE UPDATE ON public.booking_engine_questions
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_set_updated_at();

CREATE TRIGGER trg_booking_engine_question_conditions_updated_at
BEFORE UPDATE ON public.booking_engine_question_conditions
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_set_updated_at();

CREATE TRIGGER trg_booking_engine_pricing_rules_updated_at
BEFORE UPDATE ON public.booking_engine_pricing_rules
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_set_updated_at();

CREATE TRIGGER trg_booking_engine_requests_updated_at
BEFORE UPDATE ON public.booking_engine_requests
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_set_updated_at();

CREATE TRIGGER trg_booking_engine_request_items_updated_at
BEFORE UPDATE ON public.booking_engine_request_items
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_set_updated_at();

CREATE TRIGGER trg_booking_engine_service_scope_updated_at
BEFORE UPDATE ON public.booking_engine_service_scope
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_set_updated_at();


-- ------------------------------------------------------------
-- 15. Booking Engine public configuration policies
-- ------------------------------------------------------------

CREATE POLICY "booking_engine_public_read_enabled_config"
ON public.booking_engine_service_config
FOR SELECT
TO anon, authenticated
USING (enabled = true);

CREATE POLICY "booking_engine_public_read_question_conditions"
ON public.booking_engine_question_conditions
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.booking_engine_questions q
    JOIN public.booking_engine_service_config c
      ON c.id = q.service_config_id
    WHERE q.id = booking_engine_question_conditions.question_id
      AND c.enabled = true
  )
);


CREATE POLICY "booking_engine_public_read_questions"
ON public.booking_engine_questions
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.booking_engine_service_config c
    WHERE c.id = booking_engine_questions.service_config_id
      AND c.enabled = true
  )
);


CREATE POLICY "booking_engine_public_read_active_scope"
ON public.booking_engine_service_scope
FOR SELECT
TO anon, authenticated
USING (
  active = true
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_service_config c
    WHERE c.id = booking_engine_service_scope.service_config_id
      AND c.enabled = true
  )
);


-- ------------------------------------------------------------
-- 16. Booking Engine admin configuration policies
-- ------------------------------------------------------------

CREATE POLICY "booking_engine_admin_manage_service_config"
ON public.booking_engine_service_config
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "booking_engine_admin_manage_questions"
ON public.booking_engine_questions
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "booking_engine_admin_manage_question_conditions"
ON public.booking_engine_question_conditions
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "booking_engine_admin_manage_pricing_rules"
ON public.booking_engine_pricing_rules
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

CREATE POLICY "booking_engine_admin_manage_service_scope"
ON public.booking_engine_service_scope
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));


-- ------------------------------------------------------------
-- 17. Booking Engine request access policies
-- ------------------------------------------------------------

-- Admins can fully manage all Booking Engine requests.
CREATE POLICY "booking_engine_admin_manage_requests"
ON public.booking_engine_requests
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Customers can view only their own requests.
CREATE POLICY "booking_engine_customers_view_own_requests"
ON public.booking_engine_requests
FOR SELECT
TO authenticated
USING (
  NOT public.is_staff(auth.uid())
  AND public.owns_client(customer_id, auth.uid())
);

-- Customers can create requests only for their own client record.
CREATE POLICY "booking_engine_customers_create_own_requests"
ON public.booking_engine_requests
FOR INSERT
TO authenticated
WITH CHECK (
  NOT public.is_staff(auth.uid())
  AND customer_user_id = auth.uid()
  AND public.owns_client(customer_id, auth.uid())
);

-- Customers can update only their own draft requests.
CREATE POLICY "booking_engine_customers_update_own_drafts"
ON public.booking_engine_requests
FOR UPDATE
TO authenticated
USING (
  NOT public.is_staff(auth.uid())
  AND public.owns_client(customer_id, auth.uid())
  AND customer_user_id = auth.uid()
  AND status = 'draft'
)
WITH CHECK (
  NOT public.is_staff(auth.uid())
  AND public.owns_client(customer_id, auth.uid())
  AND customer_user_id = auth.uid()
  AND status = 'draft'
);


-- ------------------------------------------------------------
-- 18. Booking Engine request item access policies
-- ------------------------------------------------------------

-- Admins can fully manage all request items.
CREATE POLICY "booking_engine_admin_manage_request_items"
ON public.booking_engine_request_items
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Customers can view items belonging to their own requests.
CREATE POLICY "booking_engine_customers_view_own_request_items"
ON public.booking_engine_request_items
FOR SELECT
TO authenticated
USING (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_items.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
  )
);

-- Customers can add items only to their own draft requests.
CREATE POLICY "booking_engine_customers_create_request_items"
ON public.booking_engine_request_items
FOR INSERT
TO authenticated
WITH CHECK (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_items.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
);

-- Customers can update items only while the parent request is draft.
CREATE POLICY "booking_engine_customers_update_request_items"
ON public.booking_engine_request_items
FOR UPDATE
TO authenticated
USING (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_items.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
)
WITH CHECK (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_items.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
);

-- Customers can delete items only while the parent request is draft.
CREATE POLICY "booking_engine_customers_delete_request_items"
ON public.booking_engine_request_items
FOR DELETE
TO authenticated
USING (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_items.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
);


-- ------------------------------------------------------------
-- 19. Booking Engine request photo access policies
-- ------------------------------------------------------------

-- Admins can fully manage all request photo metadata.
CREATE POLICY "booking_engine_admin_manage_request_photos"
ON public.booking_engine_request_photos
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Customers can view photos belonging to their own requests.
CREATE POLICY "booking_engine_customers_view_own_request_photos"
ON public.booking_engine_request_photos
FOR SELECT
TO authenticated
USING (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_photos.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
  )
);

-- Customers can add photo metadata only to their own draft requests.
CREATE POLICY "booking_engine_customers_create_request_photos"
ON public.booking_engine_request_photos
FOR INSERT
TO authenticated
WITH CHECK (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_photos.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
);

-- Customers can update photo metadata only while the parent request is draft.
CREATE POLICY "booking_engine_customers_update_request_photos"
ON public.booking_engine_request_photos
FOR UPDATE
TO authenticated
USING (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_photos.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
)
WITH CHECK (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_photos.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
);

-- Customers can delete photo metadata only while the parent request is draft.
CREATE POLICY "booking_engine_customers_delete_request_photos"
ON public.booking_engine_request_photos
FOR DELETE
TO authenticated
USING (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_photos.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
);


-- ------------------------------------------------------------
-- 20. Booking Engine request event access policies
-- ------------------------------------------------------------

-- Admins can fully manage request timeline events.
CREATE POLICY "booking_engine_admin_manage_request_events"
ON public.booking_engine_request_events
FOR ALL
TO authenticated
USING (public.is_admin_or_super(auth.uid()))
WITH CHECK (public.is_admin_or_super(auth.uid()));

-- Customers can view timeline events belonging to their own requests.
CREATE POLICY "booking_engine_customers_view_own_request_events"
ON public.booking_engine_request_events
FOR SELECT
TO authenticated
USING (
  NOT public.is_staff(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.id = booking_engine_request_events.request_id
      AND public.owns_client(r.customer_id, auth.uid())
      AND r.customer_user_id = auth.uid()
  )
);


-- ------------------------------------------------------------
-- 21. Booking Engine controlled status transitions
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.booking_engine_is_valid_transition(
  _from_status public.booking_engine_request_status,
  _to_status public.booking_engine_request_status
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE _from_status
      WHEN 'draft' THEN
        _to_status IN ('submitted', 'cancelled')

      WHEN 'submitted' THEN
        _to_status IN ('under_review', 'awaiting_customer', 'rejected', 'cancelled')

      WHEN 'under_review' THEN
        _to_status IN (
          'awaiting_customer',
          'approved',
          'quote_required',
          'rejected',
          'cancelled'
        )

      WHEN 'awaiting_customer' THEN
        _to_status IN (
          'under_review',
          'customer_accepted',
          'cancelled'
        )

      WHEN 'approved' THEN
        _to_status IN (
          'quote_required',
          'ready_for_booking',
          'cancelled'
        )

      WHEN 'quote_required' THEN
        _to_status IN (
          'quote_prepared',
          'rejected',
          'cancelled'
        )

      WHEN 'quote_prepared' THEN
        _to_status IN (
          'customer_accepted',
          'cancelled'
        )

      WHEN 'customer_accepted' THEN
        _to_status IN (
          'ready_for_booking',
          'cancelled'
        )

      WHEN 'ready_for_booking' THEN
        _to_status IN ('converted', 'cancelled')

      WHEN 'converted' THEN
        false

      WHEN 'rejected' THEN
        false

      WHEN 'cancelled' THEN
        false

      ELSE
        false
    END;
$$;


-- ------------------------------------------------------------
-- 22. Enforce Booking Engine status transitions
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.booking_engine_validate_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT public.booking_engine_is_valid_transition(
       OLD.status,
       NEW.status
     )
  THEN
    RAISE EXCEPTION
      'Invalid Booking Engine status transition: % -> %',
      OLD.status,
      NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_booking_engine_validate_status_transition
BEFORE UPDATE OF status ON public.booking_engine_requests
FOR EACH ROW
EXECUTE FUNCTION public.booking_engine_validate_status_transition();


-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 23. Submit Booking Engine request
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_booking_engine_request(
  _request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.booking_engine_requests%ROWTYPE;
  v_item_count INTEGER;
  v_invalid_item_count INTEGER;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request not found';
  END IF;

  IF v_request.customer_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You do not own this Booking Engine request';
  END IF;

  IF NOT public.owns_client(v_request.customer_id, v_user_id) THEN
    RAISE EXCEPTION 'Customer ownership could not be verified';
  END IF;

  IF v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft requests can be submitted';
  END IF;

  IF v_request.requested_date IS NULL THEN
    RAISE EXCEPTION 'Requested service date is required';
  END IF;

  IF v_request.requested_time IS NULL THEN
    RAISE EXCEPTION 'Requested service time is required';
  END IF;

  IF NULLIF(TRIM(v_request.service_location), '') IS NULL THEN
    RAISE EXCEPTION 'Service location is required';
  END IF;

  IF NOT v_request.customer_acknowledged_scope THEN
    RAISE EXCEPTION 'Customer must acknowledge the service scope';
  END IF;

  SELECT COUNT(*)
  INTO v_item_count
  FROM public.booking_engine_request_items
  WHERE request_id = _request_id;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'At least one service is required';
  END IF;

  SELECT COUNT(*)
  INTO v_invalid_item_count
  FROM public.booking_engine_request_items i
  LEFT JOIN public.booking_engine_service_config c
    ON c.id = i.service_config_id
  WHERE i.request_id = _request_id
    AND (
      i.service_config_id IS NULL
      OR c.id IS NULL
      OR c.service_id IS DISTINCT FROM i.service_id
      OR c.enabled = false
    );

  IF v_invalid_item_count > 0 THEN
    RAISE EXCEPTION 'One or more requested services are not currently enabled for Booking Engine';
  END IF;

  UPDATE public.booking_engine_requests
  SET
    status = 'submitted',
    submitted_at = COALESCE(submitted_at, now()),
    updated_at = now()
  WHERE id = _request_id;

  INSERT INTO public.booking_engine_request_events (
    request_id,
    event_type,
    from_status,
    to_status,
    message,
    actor_user_id,
    actor_role
  )
  VALUES (
    _request_id,
    'submitted',
    'draft',
    'submitted',
    'Customer submitted Booking Engine request',
    v_user_id,
    'customer'
  );

  RETURN _request_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.submit_booking_engine_request(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.submit_booking_engine_request(UUID)
TO authenticated;
-- ------------------------------------------------------------
-- 24. Booking Engine quotation linkage
-- ------------------------------------------------------------

ALTER TABLE public.booking_engine_requests
  ADD COLUMN quotation_id UUID
  REFERENCES public.quotations(id)
  ON DELETE SET NULL;

CREATE INDEX idx_booking_engine_requests_quotation_id
  ON public.booking_engine_requests(quotation_id);

DROP POLICY IF EXISTS "Customers can view Booking Engine quotations"
ON public.quotations;

CREATE POLICY "Customers can view Booking Engine quotations"
ON public.quotations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE r.quotation_id = quotations.id
      AND r.customer_user_id = auth.uid()
  )
); 
-- ------------------------------------------------------------
-- 25. Create Booking Engine draft request
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_booking_engine_request(
  _requested_date DATE DEFAULT NULL,
  _requested_time TIME DEFAULT NULL,
  _service_location TEXT DEFAULT NULL,
  _customer_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_client_id UUID;
  v_client_count INTEGER;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_staff(v_user_id) THEN
    RAISE EXCEPTION 'Staff users cannot create customer Booking Engine requests';
  END IF;

  SELECT COUNT(*), MIN(id)
  INTO v_client_count, v_client_id
  FROM public.clients
  WHERE user_id = v_user_id;

  IF v_client_count = 0 THEN
    RAISE EXCEPTION 'Customer CRM record not found';
  END IF;

  IF v_client_count > 1 THEN
    RAISE EXCEPTION 'Multiple customer CRM records are linked to this account';
  END IF;

  INSERT INTO public.booking_engine_requests (
    customer_id,
    customer_user_id,
    requested_date,
    requested_time,
    service_location,
    customer_notes,
    status
  )
  VALUES (
    v_client_id,
    v_user_id,
    _requested_date,
    _requested_time,
    NULLIF(TRIM(_service_location), ''),
    NULLIF(TRIM(_customer_notes), ''),
    'draft'
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.booking_engine_request_events (
    request_id,
    event_type,
    from_status,
    to_status,
    message,
    actor_user_id,
    actor_role
  )
  VALUES (
    v_request_id,
    'created',
    NULL,
    'draft',
    'Booking Engine draft request created',
    v_user_id,
    'customer'
  );

  RETURN v_request_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.create_booking_engine_request(DATE, TIME, TEXT, TEXT)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.create_booking_engine_request(DATE, TIME, TEXT, TEXT)
TO authenticated;
-- ------------------------------------------------------------
-- 26. Update Booking Engine draft request
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_booking_engine_request(
  _request_id UUID,
  _requested_date DATE DEFAULT NULL,
  _requested_time TIME DEFAULT NULL,
  _service_location TEXT DEFAULT NULL,
  _customer_notes TEXT DEFAULT NULL,
  _customer_acknowledged_scope BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request public.booking_engine_requests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_staff(v_user_id) THEN
    RAISE EXCEPTION 'Staff users cannot update customer Booking Engine requests';
  END IF;

  SELECT *
  INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request not found';
  END IF;

  IF v_request.customer_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You do not own this Booking Engine request';
  END IF;

  IF NOT public.owns_client(v_request.customer_id, v_user_id) THEN
    RAISE EXCEPTION 'Customer ownership could not be verified';
  END IF;

  IF v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft requests can be updated';
  END IF;

  UPDATE public.booking_engine_requests
  SET
    requested_date = _requested_date,
    requested_time = _requested_time,
    service_location = NULLIF(TRIM(_service_location), ''),
    customer_notes = NULLIF(TRIM(_customer_notes), ''),
    customer_acknowledged_scope = COALESCE(_customer_acknowledged_scope, false),
    scope_acknowledged_at = CASE
      WHEN COALESCE(_customer_acknowledged_scope, false)
        THEN COALESCE(scope_acknowledged_at, now())
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = _request_id;

  RETURN _request_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.update_booking_engine_request(
  UUID,
  DATE,
  TIME,
  TEXT,
  TEXT,
  BOOLEAN
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.update_booking_engine_request(
  UUID,
  DATE,
  TIME,
  TEXT,
  TEXT,
  BOOLEAN
)
TO authenticated;
-- ------------------------------------------------------------
-- 27. Add service to Booking Engine draft
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_booking_engine_request_item(
  _request_id UUID,
  _service_id UUID,
  _quantity NUMERIC DEFAULT NULL,
  _measurements JSONB DEFAULT '{}'::jsonb,
  _answers JSONB DEFAULT '{}'::jsonb,
  _selected_extras JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request public.booking_engine_requests%ROWTYPE;
  v_config public.booking_engine_service_config%ROWTYPE;
  v_item_id UUID;
  v_display_order INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_staff(v_user_id) THEN
    RAISE EXCEPTION 'Staff users cannot add customer Booking Engine items';
  END IF;

  SELECT *
  INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request not found';
  END IF;

  IF v_request.customer_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You do not own this Booking Engine request';
  END IF;

  IF NOT public.owns_client(v_request.customer_id, v_user_id) THEN
    RAISE EXCEPTION 'Customer ownership could not be verified';
  END IF;

  IF v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'Services can only be added to draft requests';
  END IF;

  SELECT *
  INTO v_config
  FROM public.booking_engine_service_config
  WHERE service_id = _service_id
    AND enabled = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This service is not currently available through Booking Engine';
  END IF;

  IF _quantity IS NOT NULL AND _quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  SELECT COALESCE(MAX(display_order), -1) + 1
  INTO v_display_order
  FROM public.booking_engine_request_items
  WHERE request_id = _request_id;

  INSERT INTO public.booking_engine_request_items (
    request_id,
    service_id,
    service_config_id,
    display_order,
    quantity,
    measurements,
    answers,
    selected_extras,
    pricing_snapshot,
    scope_snapshot,
    service_config_version
  )
  VALUES (
    _request_id,
    _service_id,
    v_config.id,
    v_display_order,
    _quantity,
    COALESCE(_measurements, '{}'::jsonb),
    COALESCE(_answers, '{}'::jsonb),
    COALESCE(_selected_extras, '[]'::jsonb),
    '{}'::jsonb,
    '{}'::jsonb,
    v_config.config_version
  )
  RETURNING id INTO v_item_id;

  RETURN v_item_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.add_booking_engine_request_item(
  UUID,
  UUID,
  NUMERIC,
  JSONB,
  JSONB,
  JSONB
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.add_booking_engine_request_item(
  UUID,
  UUID,
  NUMERIC,
  JSONB,
  JSONB,
  JSONB
)
TO authenticated;
-- ------------------------------------------------------------
-- 28. Update Booking Engine draft item
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_booking_engine_request_item(
  _item_id UUID,
  _quantity NUMERIC DEFAULT NULL,
  _measurements JSONB DEFAULT '{}'::jsonb,
  _answers JSONB DEFAULT '{}'::jsonb,
  _selected_extras JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item public.booking_engine_request_items%ROWTYPE;
  v_request public.booking_engine_requests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_staff(v_user_id) THEN
    RAISE EXCEPTION 'Staff users cannot update customer Booking Engine items';
  END IF;

  SELECT *
  INTO v_item
  FROM public.booking_engine_request_items
  WHERE id = _item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request item not found';
  END IF;

  SELECT *
  INTO v_request
  FROM public.booking_engine_requests
  WHERE id = v_item.request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request not found';
  END IF;

  IF v_request.customer_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You do not own this Booking Engine request';
  END IF;

  IF NOT public.owns_client(v_request.customer_id, v_user_id) THEN
    RAISE EXCEPTION 'Customer ownership could not be verified';
  END IF;

  IF v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft request items can be updated';
  END IF;

  IF _quantity IS NOT NULL AND _quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  UPDATE public.booking_engine_request_items
  SET
    quantity = _quantity,
    measurements = COALESCE(_measurements, '{}'::jsonb),
    answers = COALESCE(_answers, '{}'::jsonb),
    selected_extras = COALESCE(_selected_extras, '[]'::jsonb),
    updated_at = now()
  WHERE id = _item_id;

  RETURN _item_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.update_booking_engine_request_item(
  UUID,
  NUMERIC,
  JSONB,
  JSONB,
  JSONB
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.update_booking_engine_request_item(
  UUID,
  NUMERIC,
  JSONB,
  JSONB,
  JSONB
)
TO authenticated;

-- ------------------------------------------------------------
-- 29. Delete Booking Engine draft item
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_booking_engine_request_item(
  _item_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item public.booking_engine_request_items%ROWTYPE;
  v_request public.booking_engine_requests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_staff(v_user_id) THEN
    RAISE EXCEPTION 'Staff users cannot delete customer Booking Engine items';
  END IF;

  SELECT *
  INTO v_item
  FROM public.booking_engine_request_items
  WHERE id = _item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request item not found';
  END IF;

  SELECT *
  INTO v_request
  FROM public.booking_engine_requests
  WHERE id = v_item.request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request not found';
  END IF;

  IF v_request.customer_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You do not own this Booking Engine request';
  END IF;

  IF NOT public.owns_client(v_request.customer_id, v_user_id) THEN
    RAISE EXCEPTION 'Customer ownership could not be verified';
  END IF;

  IF v_request.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft request items can be deleted';
  END IF;-- ------------------------------------------------------------

  DELETE FROM public.booking_engine_request_items
  WHERE id = _item_id;

  RETURN _item_id;
END;
$$;

REVOKE ALL
ON FUNCTION public.delete_booking_engine_request_item(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.delete_booking_engine_request_item(UUID)
TO authenticated;

-- ------------------------------------------------------------
-- 30. Booking Engine customer photo storage bucket
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-engine-photos', 'booking-engine-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Booking Engine customers read own photos" ON storage.objects;
CREATE POLICY "Booking Engine customers read own photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'booking-engine-photos'
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND r.id = split_part(name, '/', 1)::uuid
      AND r.customer_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Booking Engine customers upload own photos" ON storage.objects;
CREATE POLICY "Booking Engine customers upload own photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'booking-engine-photos'
  AND EXISTS (
    SELECT 1
    FROM public.booking_engine_requests r
    WHERE split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND r.id = split_part(name, '/', 1)::uuid
      AND r.customer_user_id = auth.uid()
      AND r.status = 'draft'
  )
);

DROP POLICY IF EXISTS "Booking Engine admins read photos" ON storage.objects;
CREATE POLICY "Booking Engine admins read photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'booking-engine-photos'
  AND is_admin_or_super(auth.uid())
);

DROP POLICY IF EXISTS "Booking Engine admins upload photos" ON storage.objects;
CREATE POLICY "Booking Engine admins upload photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'booking-engine-photos'
  AND is_admin_or_super(auth.uid())
);

DROP POLICY IF EXISTS "Booking Engine admins delete photos" ON storage.objects;
CREATE POLICY "Booking Engine admins delete photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'booking-engine-photos'
  AND is_admin_or_super(auth.uid())
);

-- ------------------------------------------------------------
-- 31. Booking Engine item pricing
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.calculate_booking_engine_item_price(
  p_request_item_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_service RECORD;
  v_config RECORD;
  v_rule RECORD;

  v_rule_count INTEGER := 0;
  v_quantity NUMERIC;
  v_measurement NUMERIC;
  v_unit_key TEXT;
  v_rate NUMERIC;
  v_subtotal NUMERIC;
  v_total NUMERIC;

  v_pricing_type TEXT;
  v_pricing_source TEXT;
  v_snapshot JSONB;
BEGIN

  -- Load the request item and its parent request.
  SELECT
    i.*,
    r.customer_user_id,
    r.status AS request_status
  INTO v_item
  FROM public.booking_engine_request_items i
  JOIN public.booking_engine_requests r
    ON r.id = i.request_id
  WHERE i.id = p_request_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request item not found';
  END IF;

  -- Authentication is required.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Only staff or the customer who owns the request may price it.
  IF NOT public.is_staff(auth.uid())
     AND v_item.customer_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to calculate this request item';
  END IF;

  -- Load the existing service catalogue record.
  SELECT
    s.id,
    s.name,
    s.category,
    s.base_price,
    s.pricing_model,
    s.pricing_unit,
    s.price_per_sqm,
    s.is_active
  INTO v_service
  FROM public.services s
  WHERE s.id = v_item.service_id;

  IF NOT FOUND OR v_service.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Selected service is no longer active';
  END IF;

  -- Load Booking Engine configuration if one exists.
  SELECT *
  INTO v_config
  FROM public.booking_engine_service_config
  WHERE service_id = v_service.id
    AND enabled = true
  LIMIT 1;

  -- ----------------------------------------------------------
  -- Check for applicable active pricing rules.
  -- ----------------------------------------------------------

   -- ----------------------------------------------------------
  -- Check for applicable active pricing rules.
  -- ----------------------------------------------------------

  IF v_config.id IS NOT NULL THEN

    -- A quotation rule is exclusive: it must be the only active rule.
    SELECT COUNT(*)
    INTO v_rule_count
    FROM public.booking_engine_pricing_rules pr
    WHERE pr.service_config_id = v_config.id
      AND pr.active = true
      AND pr.pricing_type = 'quotation';

    IF v_rule_count > 0 THEN

      IF (
        SELECT COUNT(*)
        FROM public.booking_engine_pricing_rules pr
        WHERE pr.service_config_id = v_config.id
          AND pr.active = true
      ) > 1 THEN
        RAISE EXCEPTION
          'Quotation pricing rule must be the only active pricing rule for service "%".',
          v_service.name;
      END IF;

      SELECT pr.*
      INTO v_rule
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id
        AND pr.active = true
        AND pr.pricing_type = 'quotation'
      LIMIT 1;

      v_snapshot := jsonb_build_object(
        'status', 'quotation_required',
        'pricing_type', 'quotation',
        'pricing_source', 'booking_engine_rule',
        'service_id', v_service.id,
        'service_name', v_service.name,
        'configuration_version',
          COALESCE(v_config.config_version, 1),
        'rule_id', v_rule.id,
        'currency', v_rule.currency
      );

      UPDATE public.booking_engine_request_items
      SET pricing_snapshot = v_snapshot,
          updated_at = now()
      WHERE id = p_request_item_id;

      RETURN v_snapshot;
    END IF;

    -- Tiered pricing may have multiple active rules.
    IF EXISTS (
      SELECT 1
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id
        AND pr.active = true
        AND pr.pricing_type = 'tiered'
    ) THEN

      -- Tiered pricing requires a quantity.
      v_quantity := v_item.quantity;

      IF v_quantity IS NULL OR v_quantity <= 0 THEN
        RAISE EXCEPTION
          'A valid quantity is required for tiered pricing of service "%".',
          v_service.name;
      END IF;

      SELECT COUNT(*)
      INTO v_rule_count
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id
        AND pr.active = true
        AND pr.pricing_type = 'tiered'
        AND v_quantity >= COALESCE(pr.minimum_quantity, 0)
        AND (
          pr.maximum_quantity IS NULL
          OR v_quantity <= pr.maximum_quantity
        );

      IF v_rule_count = 0 THEN
        RAISE EXCEPTION
          'No pricing tier matches quantity % for service "%".',
          v_quantity,
          v_service.name;
      END IF;

      IF v_rule_count > 1 THEN
        RAISE EXCEPTION
          'Multiple pricing tiers match quantity % for service "%".',
          v_quantity,
          v_service.name;
      END IF;

      SELECT pr.*
      INTO v_rule
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id
        AND pr.active = true
        AND pr.pricing_type = 'tiered'
        AND v_quantity >= COALESCE(pr.minimum_quantity, 0)
        AND (
          pr.maximum_quantity IS NULL
          OR v_quantity <= pr.maximum_quantity
        )
      LIMIT 1;

      v_pricing_type := 'tiered';
      v_rate := v_rule.rate;
      v_unit_key := v_rule.unit_key;
      v_pricing_source := 'booking_engine_rule';
      v_subtotal := v_quantity * v_rate;

    ELSE

      -- Non-tiered pricing must have exactly one active rule.
      SELECT COUNT(*)
      INTO v_rule_count
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id
        AND pr.active = true;

      IF v_rule_count > 1 THEN
        RAISE EXCEPTION
          'Multiple active pricing rules are configured for service "%".',
          v_service.name;
      END IF;

      IF v_rule_count = 1 THEN

        SELECT pr.*
        INTO v_rule
        FROM public.booking_engine_pricing_rules pr
        WHERE pr.service_config_id = v_config.id
          AND pr.active = true
        LIMIT 1;

        v_pricing_type := v_rule.pricing_type;
        v_rate := v_rule.rate;
        v_unit_key := v_rule.unit_key;
        v_pricing_source := 'booking_engine_rule';

        -- Measurement-based pricing.
        IF v_pricing_type = 'per_measurement' THEN

          IF v_unit_key IS NULL OR v_unit_key = '' THEN
            RAISE EXCEPTION
              'Measurement unit is missing for service "%".',
              v_service.name;
          END IF;

          v_measurement :=
            NULLIF(v_item.measurements ->> v_unit_key, '')::NUMERIC;

          IF v_measurement IS NULL OR v_measurement <= 0 THEN
            RAISE EXCEPTION
              'A valid % measurement is required for service "%".',
              v_unit_key,
              v_service.name;
          END IF;

          v_subtotal := v_measurement * v_rate;

        ELSE

          -- Quantity-based pricing.
          v_quantity := COALESCE(v_item.quantity, 1);

          IF v_quantity <= 0 THEN
            RAISE EXCEPTION
              'A valid quantity is required for service "%".',
              v_service.name;
          END IF;

          IF v_pricing_type = 'fixed' THEN
            v_subtotal := v_rate;

          ELSIF v_pricing_type = 'per_unit' THEN
            v_subtotal := v_quantity * v_rate;

          ELSE
            RAISE EXCEPTION
              'Unsupported Booking Engine pricing type "%" for service "%".',
              v_pricing_type,
              v_service.name;
          END IF;

        END IF;

      END IF;

    END IF;

  END IF;
      -- --------------------------------------------------------
      -- No Booking Engine pricing rule.
      -- Fall back to the existing service catalogue.
      -- --------------------------------------------------------

      IF v_service.base_price IS NULL
         OR v_service.base_price <= 0 THEN

        v_snapshot := jsonb_build_object(
          'status', 'quotation_required',
          'pricing_type', 'quotation',
          'pricing_source', 'service_catalogue',
          'service_id', v_service.id,
          'service_name', v_service.name,
          'base_price', v_service.base_price,
          'configuration_version',
            COALESCE(v_config.config_version, 1),
          'currency', 'KES'
        );

        UPDATE public.booking_engine_request_items
        SET pricing_snapshot = v_snapshot,
            updated_at = now()
        WHERE id = p_request_item_id;

        RETURN v_snapshot;
      END IF;

      v_pricing_source := 'service_catalogue';

      IF v_service.pricing_model = 'fixed' THEN

        v_pricing_type := 'fixed';
        v_subtotal := v_service.base_price;

      ELSIF v_service.pricing_model = 'per_unit' THEN

        v_pricing_type := 'per_unit';
        v_quantity := COALESCE(v_item.quantity, 1);

        IF v_quantity <= 0 THEN
          RAISE EXCEPTION
            'A valid quantity is required for service "%".',
            v_service.name;
        END IF;

        v_subtotal := v_service.base_price * v_quantity;

      ELSIF v_service.pricing_model = 'variation' THEN

        v_snapshot := jsonb_build_object(
          'status', 'configuration_required',
          'pricing_type', 'variation',
          'pricing_source', 'service_catalogue',
          'service_id', v_service.id,
          'service_name', v_service.name,
          'base_price', v_service.base_price,
          'configuration_version',
            COALESCE(v_config.config_version, 1),
          'currency', 'KES'
        );

        UPDATE public.booking_engine_request_items
        SET pricing_snapshot = v_snapshot,
            updated_at = now()
        WHERE id = p_request_item_id;

        RETURN v_snapshot;

      ELSE

        RAISE EXCEPTION
          'Unsupported pricing model "%" for service "%".',
          v_service.pricing_model,
          v_service.name;

      END IF;

    END IF;

  ELSE

    -- No Booking Engine configuration exists.
    -- Existing catalogue remains the fallback.

    IF v_service.base_price IS NULL
       OR v_service.base_price <= 0 THEN

      v_snapshot := jsonb_build_object(
        'status', 'quotation_required',
        'pricing_type', 'quotation',
        'pricing_source', 'service_catalogue',
        'service_id', v_service.id,
        'service_name', v_service.name,
        'base_price', v_service.base_price,
        'currency', 'KES'
      );

      UPDATE public.booking_engine_request_items
      SET pricing_snapshot = v_snapshot,
          updated_at = now()
      WHERE id = p_request_item_id;

      RETURN v_snapshot;
    END IF;

    IF v_service.pricing_model = 'fixed' THEN

      v_pricing_type := 'fixed';
      v_pricing_source := 'service_catalogue';
      v_subtotal := v_service.base_price;

    ELSIF v_service.pricing_model = 'per_unit' THEN

      v_pricing_type := 'per_unit';
      v_pricing_source := 'service_catalogue';
      v_quantity := COALESCE(v_item.quantity, 1);
      v_subtotal := v_service.base_price * v_quantity;

    ELSE

      v_snapshot := jsonb_build_object(
        'status', 'configuration_required',
        'pricing_type', 'variation',
        'pricing_source', 'service_catalogue',
        'service_id', v_service.id,
        'service_name', v_service.name,
        'base_price', v_service.base_price,
        'currency', 'KES'
      );

      UPDATE public.booking_engine_request_items
      SET pricing_snapshot = v_snapshot,
          updated_at = now()
      WHERE id = p_request_item_id;

      RETURN v_snapshot;

    END IF;

  END IF;

  v_total := ROUND(v_subtotal, 2);

  v_snapshot := jsonb_build_object(
    'status', 'priced',
    'pricing_type', v_pricing_type,
    'pricing_source', v_pricing_source,
    'service_id', v_service.id,
    'service_name', v_service.name,
    'service_category', v_service.category,
    'base_price', v_service.base_price,
    'quantity', v_quantity,
    'measurement_unit', v_unit_key,
    'measurement_value', v_measurement,
    'rate', v_rate,
    'subtotal', v_subtotal,
    'discount_amount', 0,
    'total', v_total,
    'currency', COALESCE(v_rule.currency, 'KES'),
    'configuration_version',
      COALESCE(v_config.config_version, 1),
    'calculated_at', now()
  );

  UPDATE public.booking_engine_request_items
  SET pricing_snapshot = v_snapshot,
      updated_at = now()
  WHERE id = p_request_item_id;

  RETURN v_snapshot;
END;
$$;

REVOKE ALL
ON FUNCTION public.calculate_booking_engine_item_price(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.calculate_booking_engine_item_price(UUID)
TO authenticated;

-- ============================================================
-- Booking Engine conversion into the existing bookings module
-- ============================================================

CREATE OR REPLACE FUNCTION public.convert_booking_engine_request(
  _request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_client RECORD;
  v_booking_id UUID;
  v_booking_code TEXT;
  v_line_items JSONB;
  v_item RECORD;
  v_snapshot JSONB;
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_total NUMERIC := 0;
  v_primary_service_id UUID;
  v_primary_service_name TEXT;
  v_item_price NUMERIC;
  v_item_total NUMERIC;
  v_item_discount NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  -- Lock the request so concurrent conversion attempts cannot
  -- create duplicate bookings.
  SELECT *
  INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Booking Engine request not found.';
  END IF;

  IF v_request.customer_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You are not authorized to convert this request.';
  END IF;

  -- Idempotency: if conversion already happened, return the
  -- existing booking instead of creating another one.
  IF v_request.converted_booking_id IS NOT NULL THEN
    SELECT id, booking_code
    INTO v_booking_id, v_booking_code
    FROM public.bookings
    WHERE id = v_request.converted_booking_id;

    IF v_booking_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'already_converted',
        'request_id', v_request.id,
        'booking_id', v_booking_id,
        'booking_code', v_booking_code
      );
    END IF;
  END IF;

  IF v_request.status <> 'ready_for_booking' THEN
    RAISE EXCEPTION
      'Request must be ready_for_booking before conversion. Current status: %.',
      v_request.status;
  END IF;

  IF v_request.customer_id IS NULL THEN
    RAISE EXCEPTION 'Request is not linked to a CRM client.';
  END IF;

  SELECT id, full_name, phone
  INTO v_client
  FROM public.clients
  WHERE id = v_request.customer_id
  FOR SHARE;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Linked CRM client was not found.';
  END IF;

  -- Build the existing ERP line_items structure from the frozen
  -- Booking Engine pricing snapshots.
  v_line_items := '[]'::jsonb;

  FOR v_item IN
    SELECT
      ri.*,
      s.service_code,
      s.name AS service_name,
      s.description AS service_description
    FROM public.booking_engine_request_items ri
    JOIN public.services s
      ON s.id = ri.service_id
    WHERE ri.request_id = v_request.id
    ORDER BY ri.display_order, ri.created_at
  LOOP
    IF v_primary_service_id IS NULL THEN
      v_primary_service_id := v_item.service_id;
      v_primary_service_name := v_item.service_name;
    END IF;

    v_snapshot := COALESCE(v_item.pricing_snapshot, '{}'::jsonb);

    IF COALESCE(v_snapshot ->> 'status', '') <> 'priced' THEN
      RAISE EXCEPTION
        'Service "%" does not have a final price. Complete quotation/pricing first.',
        v_item.service_name;
    END IF;

    v_item_price :=
      COALESCE((v_snapshot ->> 'rate')::NUMERIC, 0);

    v_item_total :=
      COALESCE((v_snapshot ->> 'total')::NUMERIC, 0);

    v_item_discount :=
      COALESCE((v_snapshot ->> 'discount_amount')::NUMERIC, 0);

    v_subtotal := v_subtotal +
      COALESCE((v_snapshot ->> 'subtotal')::NUMERIC, v_item_total);

    v_discount := v_discount + v_item_discount;
    v_total := v_total + v_item_total;

    v_line_items := v_line_items || jsonb_build_array(
      jsonb_build_object(
        'id', v_item.service_id,
        'code', v_item.service_code,
        'name', v_item.service_name,
        'description', v_item.service_description,
        'price', v_item_price,
        'quantity', COALESCE(v_item.quantity, 1),
        'discount', v_item_discount,
        'total', v_item_total
      )
    );
  END LOOP;

  IF v_primary_service_id IS NULL THEN
    RAISE EXCEPTION 'Booking Engine request contains no services.';
  END IF;

  -- Create exactly one existing ERP booking.
  -- booking_code is intentionally omitted so the existing
  -- trg_assign_booking_code trigger generates it.
  INSERT INTO public.bookings (
  agent_id,
  client_id,
  client_name,
  client_phone,
  location,
  service_id,
  service_date,
  quantity,
  price,
  system_price,
  status,
    created_by_name,
    created_by_role,
    line_items,
    subtotal,
    discount_amount,
    discount_approval_status
  )
  VALUES (
  v_request.customer_user_id,
  v_client.id,
  v_client.full_name,
  v_client.phone,
  v_request.service_location,
  v_primary_service_id,
  v_request.requested_date,
  (
    SELECT COALESCE(SUM(COALESCE(quantity, 1)), 0)::text
    FROM public.booking_engine_request_items
    WHERE request_id = v_request.id
  ),
    v_total,
    v_subtotal,
    'pending',
    v_client.full_name,
    'customer',
    v_line_items,
    v_subtotal,
    v_discount,
    'not_required'
  )
  RETURNING id, booking_code
  INTO v_booking_id, v_booking_code;

  UPDATE public.booking_engine_requests
  SET converted_booking_id = v_booking_id,
      status = 'converted',
      converted_at = now(),
      updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.booking_engine_request_events (
    request_id,
    event_type,
    from_status,
    to_status,
    message,
    actor_user_id,
    actor_user_name,
    actor_role,
    metadata
  )
  VALUES (
    v_request.id,
    'converted',
    v_request.status,
    'converted',
    'Booking Engine request converted to existing ERP booking.',
    auth.uid(),
    v_client.full_name,
    'customer',
    jsonb_build_object(
      'booking_id', v_booking_id,
      'booking_code', v_booking_code
    )
  );

  RETURN jsonb_build_object(
    'status', 'converted',
    'request_id', v_request.id,
    'booking_id', v_booking_id,
    'booking_code', v_booking_code,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'total', v_total
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.convert_booking_engine_request(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.convert_booking_engine_request(UUID)
TO authenticated;

-- ============================================================
-- Booking Engine: price all items in a request
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_booking_engine_request_price(
  _request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_item RECORD;
  v_result JSONB;

  v_item_count INTEGER := 0;
  v_priced_count INTEGER := 0;
  v_quote_required_count INTEGER := 0;

  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_total NUMERIC := 0;

  v_overall_status TEXT := 'priced';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  -- Only the customer who owns the request or an admin/super admin
  -- may run request-wide pricing.
  SELECT *
  INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Booking Engine request not found.';
  END IF;

  IF NOT (
    public.is_admin_or_super(auth.uid())
    OR v_request.customer_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You are not authorized to price this request.';
  END IF;

  FOR v_item IN
    SELECT id
    FROM public.booking_engine_request_items
    WHERE request_id = _request_id
    ORDER BY display_order, created_at
  LOOP
    v_item_count := v_item_count + 1;

    v_result :=
      public.calculate_booking_engine_item_price(v_item.id);

    IF COALESCE(v_result ->> 'status', '') = 'priced' THEN
      v_priced_count := v_priced_count + 1;

      v_subtotal := v_subtotal +
        COALESCE((v_result ->> 'subtotal')::NUMERIC, 0);

      v_discount := v_discount +
        COALESCE((v_result ->> 'discount_amount')::NUMERIC, 0);

      v_total := v_total +
        COALESCE((v_result ->> 'total')::NUMERIC, 0);

    ELSIF COALESCE(v_result ->> 'status', '') = 'quotation_required' THEN
      v_quote_required_count := v_quote_required_count + 1;
    ELSE
      RAISE EXCEPTION
        'Unable to price Booking Engine item %.',
        v_item.id;
    END IF;
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Booking Engine request contains no services.';
  END IF;

  IF v_quote_required_count > 0 THEN
    v_overall_status := 'quotation_required';
  END IF;

  RETURN jsonb_build_object(
    'status', v_overall_status,
    'request_id', _request_id,
    'item_count', v_item_count,
    'priced_count', v_priced_count,
    'quote_required_count', v_quote_required_count,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'total', v_total
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.calculate_booking_engine_request_price(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.calculate_booking_engine_request_price(UUID)
TO authenticated;


-- ============================================================
-- Booking Engine: prepare quotation from a request
-- ============================================================

CREATE OR REPLACE FUNCTION public.prepare_booking_engine_quotation(
  _request_id UUID,
  _quoted_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_client RECORD;
  v_staff RECORD;
  v_item RECORD;
  v_price_result JSONB;
  v_quoted_item JSONB;
  v_snapshot JSONB;

  v_quotation_id UUID;
  v_quotation_number TEXT;
  v_line_items JSONB := '[]'::jsonb;

  v_item_count INTEGER := 0;
  v_quotation_required_count INTEGER := 0;
  v_quoted_count INTEGER := 0;

  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_total NUMERIC := 0;

  v_item_price NUMERIC;
  v_item_total NUMERIC;
  v_item_discount NUMERIC;
  v_quoted_amount NUMERIC;

  v_primary_service_name TEXT;
  v_local_id TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  IF NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION
      'Only admins and super admins can prepare Booking Engine quotations.';
  END IF;

  IF jsonb_typeof(_quoted_items) <> 'array' THEN
    RAISE EXCEPTION 'Quoted items must be a JSON array.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Booking Engine request not found.';
  END IF;

  -- Idempotency: never create a second quotation for the same request.
  IF v_request.quotation_id IS NOT NULL THEN
    SELECT id, quotation_number
    INTO v_quotation_id, v_quotation_number
    FROM public.quotations
    WHERE id = v_request.quotation_id;

    IF v_quotation_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'already_prepared',
        'request_id', v_request.id,
        'quotation_id', v_quotation_id,
        'quotation_number', v_quotation_number
      );
    END IF;
  END IF;

IF v_request.status <> 'quote_required' THEN
  RAISE EXCEPTION
    'Request must be in quote_required before quotation preparation. Current status: %.',
    v_request.status;
END IF;

  IF v_request.customer_id IS NULL THEN
    RAISE EXCEPTION 'Request is not linked to a CRM client.';
  END IF;

  SELECT id, full_name, phone
  INTO v_client
  FROM public.clients
  WHERE id = v_request.customer_id
  FOR SHARE;

  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Linked CRM client was not found.';
  END IF;

  SELECT
    p.full_name,
    ur.role::text AS role
  INTO v_staff
  FROM public.profiles p
  JOIN public.user_roles ur
    ON ur.user_id = p.user_id
  WHERE p.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  LIMIT 1;

  IF v_staff.full_name IS NULL OR v_staff.role IS NULL THEN
    RAISE EXCEPTION
      'Staff profile or role could not be determined.';
  END IF;

  -- Price every request item.
  -- Automatically priced services keep their calculated price.
  -- Quotation-required services must receive a staff-entered amount.
  FOR v_item IN
    SELECT
      ri.id,
      ri.service_id,
      ri.quantity,
      ri.measurements,
      ri.display_order,
      ri.created_at,
      s.service_code,
      s.name AS service_name,
      s.description AS service_description
    FROM public.booking_engine_request_items ri
    JOIN public.services s
      ON s.id = ri.service_id
    WHERE ri.request_id = v_request.id
    ORDER BY ri.display_order, ri.created_at
  LOOP
    v_item_count := v_item_count + 1;

    v_price_result :=
      public.calculate_booking_engine_item_price(v_item.id);

    IF COALESCE(v_price_result ->> 'status', '') = 'priced' THEN

      v_item_price :=
        COALESCE((v_price_result ->> 'rate')::NUMERIC, 0);

      v_item_total :=
        COALESCE((v_price_result ->> 'total')::NUMERIC, 0);

      v_item_discount :=
        COALESCE((v_price_result ->> 'discount_amount')::NUMERIC, 0);

      v_subtotal := v_subtotal +
        COALESCE((v_price_result ->> 'subtotal')::NUMERIC, v_item_total);

      v_discount := v_discount + v_item_discount;
      v_total := v_total + v_item_total;

      IF v_primary_service_name IS NULL THEN
        v_primary_service_name := v_item.service_name;
      END IF;

      v_line_items := v_line_items || jsonb_build_array(
        jsonb_build_object(
          'id', v_item.service_id,
          'code', v_item.service_code,
          'name', v_item.service_name,
          'description', v_item.service_description,
          'price', v_item_price,
          'quantity', COALESCE(v_item.quantity, 1),
          'discount', v_item_discount,
          'total', v_item_total
        )
      );

    ELSIF COALESCE(v_price_result ->> 'status', '') = 'quotation_required' THEN

      v_quotation_required_count := v_quotation_required_count + 1;

      SELECT item
      INTO v_quoted_item
      FROM jsonb_array_elements(_quoted_items) AS item
      WHERE item ->> 'item_id' = v_item.id::text
      LIMIT 1;

      IF v_quoted_item IS NULL THEN
        RAISE EXCEPTION
          'A quoted amount is required for service "%".',
          v_item.service_name;
      END IF;

      v_quoted_amount :=
        NULLIF(v_quoted_item ->> 'quoted_amount', '')::NUMERIC;

      IF v_quoted_amount IS NULL OR v_quoted_amount <= 0 THEN
        RAISE EXCEPTION
          'Quoted amount for service "%" must be greater than zero.',
          v_item.service_name;
      END IF;

      v_quoted_count := v_quoted_count + 1;

      v_item_price := v_quoted_amount;
      v_item_discount := 0;
      v_item_total := v_quoted_amount;

      v_subtotal := v_subtotal + v_quoted_amount;
      v_total := v_total + v_quoted_amount;

      IF v_primary_service_name IS NULL THEN
        v_primary_service_name := v_item.service_name;
      END IF;

      -- Freeze the staff-approved quotation price into the
      -- existing Booking Engine pricing snapshot structure.
      v_snapshot := jsonb_build_object(
        'status', 'priced',
        'pricing_type', 'quotation',
        'pricing_source', 'booking_engine_staff_quotation',
        'service_id', v_item.service_id,
        'service_name', v_item.service_name,
        'quantity', COALESCE(v_item.quantity, 1),
        'quoted_amount', v_quoted_amount,
        'rate', v_quoted_amount,
        'subtotal', v_quoted_amount,
        'discount_amount', 0,
        'total', v_quoted_amount,
        'currency', 'KES',
        'configuration_version',
          COALESCE(
            (v_price_result ->> 'configuration_version')::INTEGER,
            1
          ),
        'quoted_by', auth.uid(),
        'quoted_by_name', v_staff.full_name,
        'quoted_at', now()
      );

      UPDATE public.booking_engine_request_items
      SET pricing_snapshot = v_snapshot,
          updated_at = now()
      WHERE id = v_item.id;

      v_line_items := v_line_items || jsonb_build_array(
        jsonb_build_object(
          'id', v_item.service_id,
          'code', v_item.service_code,
          'name', v_item.service_name,
          'description', v_item.service_description,
          'price', v_item_price,
          'quantity', COALESCE(v_item.quantity, 1),
          'discount', 0,
          'total', v_item_total
        )
      );

    ELSE
      RAISE EXCEPTION
        'Unable to price Booking Engine item "%".',
        v_item.service_name;
    END IF;
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION
      'Booking Engine request contains no services.';
  END IF;

  IF v_quotation_required_count = 0 THEN
    RAISE EXCEPTION
      'This request does not require a staff quotation.';
  END IF;

  IF v_quoted_count <> v_quotation_required_count THEN
    RAISE EXCEPTION
      'Every quotation-required service must have a quoted amount.';
  END IF;

  SELECT public.next_quotation_number()
  INTO v_quotation_number;

  v_local_id := 'BE-' || v_request.id::text;

  INSERT INTO public.quotations (
    quotation_number,
    client_name,
    client_phone,
    service_name,
    service_date,
    price,
    created_by,
    created_by_name,
    created_by_role,
    salesperson_id,
    salesperson_name,
    salesperson_role,
    line_items,
    subtotal,
    discount_amount,
    discount_reason,
    local_id
  )
  VALUES (
    v_quotation_number,
    v_client.full_name,
    v_client.phone,
    COALESCE(v_primary_service_name, 'Cleaning Service'),
    v_request.requested_date,
    v_total,
    auth.uid(),
    v_staff.full_name,
    v_staff.role,
    auth.uid(),
    v_staff.full_name,
    v_staff.role,
    v_line_items,
    v_subtotal,
    v_discount,
    CASE
      WHEN v_discount > 0
        THEN 'Booking Engine pricing adjustment'
      ELSE NULL
    END,
    v_local_id
  )
  RETURNING id
  INTO v_quotation_id;

  UPDATE public.booking_engine_requests
  SET quotation_id = v_quotation_id,
      status = 'quote_prepared',
      updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.booking_engine_request_events (
    request_id,
    event_type,
    from_status,
    to_status,
    message,
    actor_user_id,
    actor_user_name,
    actor_role,
    metadata
  )
  VALUES (
    v_request.id,
    'quote_prepared',
    v_request.status,
    'quote_prepared',
    'Quotation prepared from Booking Engine request.',
    auth.uid(),
    v_staff.full_name,
    v_staff.role,
    jsonb_build_object(
      'quotation_id', v_quotation_id,
      'quotation_number', v_quotation_number,
      'subtotal', v_subtotal,
      'discount_amount', v_discount,
      'total', v_total
    )
  );

  RETURN jsonb_build_object(
    'status', 'quote_prepared',
    'request_id', v_request.id,
    'quotation_id', v_quotation_id,
    'quotation_number', v_quotation_number,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'total', v_total
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.prepare_booking_engine_quotation(UUID, JSONB)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.prepare_booking_engine_quotation(UUID, JSONB)
TO authenticated;

-- ============================================================
-- Booking Engine: customer accepts prepared quotation
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_booking_engine_quotation(
  _request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_quotation RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Booking Engine request not found.';
  END IF;

  IF v_request.customer_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION
      'You are not authorized to accept this quotation.';
  END IF;

  IF v_request.customer_id IS NULL
     OR NOT public.owns_client(v_request.customer_id, auth.uid())
  THEN
    RAISE EXCEPTION
      'The Booking Engine request is not linked to your CRM client.';
  END IF;

  IF v_request.status <> 'quote_prepared' THEN
    RAISE EXCEPTION
      'Request must be in quote_prepared before quotation acceptance. Current status: %.',
      v_request.status;
  END IF;

  IF v_request.quotation_id IS NULL THEN
    RAISE EXCEPTION
      'This Booking Engine request does not have a quotation.';
  END IF;

  SELECT id, quotation_number, price
  INTO v_quotation
  FROM public.quotations
  WHERE id = v_request.quotation_id;

  IF v_quotation.id IS NULL THEN
    RAISE EXCEPTION
      'The linked quotation could not be found.';
  END IF;

  UPDATE public.booking_engine_requests
  SET status = 'customer_accepted',
      updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.booking_engine_request_events (
    request_id,
    event_type,
    from_status,
    to_status,
    message,
    actor_user_id,
    actor_user_name,
    actor_role,
    metadata
  )
  VALUES (
    v_request.id,
    'customer_accepted',
    v_request.status,
    'customer_accepted',
    'Customer accepted the prepared quotation.',
    auth.uid(),
    NULL,
    'customer',
    jsonb_build_object(
      'quotation_id', v_quotation.id,
      'quotation_number', v_quotation.quotation_number,
      'quotation_price', v_quotation.price,
      'accepted_at', now()
    )
  );

  RETURN jsonb_build_object(
    'status', 'customer_accepted',
    'request_id', v_request.id,
    'quotation_id', v_quotation.id,
    'quotation_number', v_quotation.quotation_number,
    'quotation_price', v_quotation.price
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.accept_booking_engine_quotation(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.accept_booking_engine_quotation(UUID)
TO authenticated;

-- ============================================================
-- Booking Engine: finalize request as ready for booking
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_booking_engine_ready_for_booking(
  _request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_user_id UUID := auth.uid();
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  SELECT *
  INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Booking Engine request not found.';
  END IF;

  SELECT
    p.full_name,
    ur.role::text
  INTO v_actor_name, v_actor_role
  FROM public.profiles p
  JOIN public.user_roles ur
    ON ur.user_id = p.user_id
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF v_request.status = 'approved' THEN

    IF NOT public.is_admin_or_super(v_user_id) THEN
      RAISE EXCEPTION
        'Only admins and super admins can approve a request for booking.';
    END IF;

  ELSIF v_request.status = 'customer_accepted' THEN

    IF v_request.customer_user_id IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION
        'Only the customer who accepted the quotation can finalize this request.';
    END IF;

    IF v_request.customer_id IS NULL
       OR NOT public.owns_client(v_request.customer_id, v_user_id)
    THEN
      RAISE EXCEPTION
        'The Booking Engine request is not linked to your CRM client.';
    END IF;

  ELSE
    RAISE EXCEPTION
      'Request must be approved or customer_accepted before it can become ready_for_booking. Current status: %.',
      v_request.status;
  END IF;

  UPDATE public.booking_engine_requests
  SET status = 'ready_for_booking',
      updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.booking_engine_request_events (
    request_id,
    event_type,
    from_status,
    to_status,
    message,
    actor_user_id,
    actor_user_name,
    actor_role,
    metadata
  )
  VALUES (
    v_request.id,
    'ready_for_booking',
    v_request.status,
    'ready_for_booking',
    'Booking Engine request is ready for conversion to the existing ERP booking workflow.',
    v_user_id,
    v_actor_name,
    COALESCE(v_actor_role, 'customer'),
    jsonb_build_object(
      'ready_at', now()
    )
  );

  RETURN jsonb_build_object(
    'status', 'ready_for_booking',
    'request_id', v_request.id
  );
END;
$$;

REVOKE ALL
ON FUNCTION public.mark_booking_engine_ready_for_booking(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.mark_booking_engine_ready_for_booking(UUID)
TO authenticated;
