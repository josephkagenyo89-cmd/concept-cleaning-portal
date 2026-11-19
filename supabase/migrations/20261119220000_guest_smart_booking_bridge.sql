-- Smart Booking guest bridge: preserve the guest enquiry, create a native
-- Booking Engine request with server-calculated snapshots, and hand off to ERP.
-- This migration is source-only until explicitly applied to the Supabase project.

ALTER TABLE public.guest_service_requests
  ADD COLUMN IF NOT EXISTS booking_details_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submission_key uuid,
  ADD COLUMN IF NOT EXISTS booking_engine_request_id uuid,
  ADD COLUMN IF NOT EXISTS booking_engine_request_number text,
  ADD COLUMN IF NOT EXISTS booking_engine_status text,
  ADD COLUMN IF NOT EXISTS quotation_id uuid,
  ADD COLUMN IF NOT EXISTS converted_booking_id uuid,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_confirmation_channel text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guest_service_requests_booking_details_object'
      AND conrelid = 'public.guest_service_requests'::regclass
  ) THEN
    ALTER TABLE public.guest_service_requests
      ADD CONSTRAINT guest_service_requests_booking_details_object
      CHECK (jsonb_typeof(booking_details_snapshot) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guest_service_requests_booking_engine_request_fkey'
      AND conrelid = 'public.guest_service_requests'::regclass
  ) THEN
    ALTER TABLE public.guest_service_requests
      ADD CONSTRAINT guest_service_requests_booking_engine_request_fkey
      FOREIGN KEY (booking_engine_request_id)
      REFERENCES public.booking_engine_requests(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guest_service_requests_quotation_fkey'
      AND conrelid = 'public.guest_service_requests'::regclass
  ) THEN
    ALTER TABLE public.guest_service_requests
      ADD CONSTRAINT guest_service_requests_quotation_fkey
      FOREIGN KEY (quotation_id)
      REFERENCES public.quotations(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guest_service_requests_booking_fkey'
      AND conrelid = 'public.guest_service_requests'::regclass
  ) THEN
    ALTER TABLE public.guest_service_requests
      ADD CONSTRAINT guest_service_requests_booking_fkey
      FOREIGN KEY (converted_booking_id)
      REFERENCES public.bookings(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guest_service_requests_confirmation_channel_check'
      AND conrelid = 'public.guest_service_requests'::regclass
  ) THEN
    ALTER TABLE public.guest_service_requests
      ADD CONSTRAINT guest_service_requests_confirmation_channel_check
      CHECK (
        customer_confirmation_channel IS NULL
        OR customer_confirmation_channel IN ('whatsapp', 'phone', 'email', 'in_person')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guest_service_requests_booking_engine_status_check'
      AND conrelid = 'public.guest_service_requests'::regclass
  ) THEN
    ALTER TABLE public.guest_service_requests
      ADD CONSTRAINT guest_service_requests_booking_engine_status_check
      CHECK (
        booking_engine_status IS NULL
        OR booking_engine_status IN (
          'draft','submitted','under_review','awaiting_customer','approved',
          'quote_required','quote_prepared','customer_accepted','ready_for_booking',
          'converted','rejected','cancelled'
        )
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_guest_service_requests_submission_key
  ON public.guest_service_requests(submission_key)
  WHERE submission_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_guest_service_requests_booking_engine_request
  ON public.guest_service_requests(booking_engine_request_id)
  WHERE booking_engine_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guest_service_requests_booking_engine_status
  ON public.guest_service_requests(booking_engine_status);

-- Validate the answer payload against the currently published service setup.
-- The helper is callable only by the trusted conversion function.
CREATE OR REPLACE FUNCTION public.assert_guest_booking_engine_answers(
  p_service_config_id uuid,
  p_answers jsonb,
  p_quantity numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_config public.booking_engine_service_config%ROWTYPE;
  v_question record;
  v_condition record;
  v_answer jsonb;
  v_dependency_answer jsonb;
  v_actual text;
  v_expected text;
  v_match boolean;
  v_visible boolean;
  v_required boolean;
  v_min numeric;
  v_max numeric;
  v_min_length integer;
  v_max_length integer;
  v_answer_text text;
  v_option jsonb;
  v_selected jsonb;
  v_valid boolean;
BEGIN
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' THEN
    RAISE EXCEPTION 'The guest service answers are invalid. Please ask the customer to resubmit.';
  END IF;

  SELECT * INTO v_config
  FROM public.booking_engine_service_config
  WHERE id = p_service_config_id AND enabled IS TRUE
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This service is no longer enabled for guided booking.';
  END IF;

  IF COALESCE((v_config.measurement_config #>> '{quantity,enabled}')::boolean, false) THEN
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
      RAISE EXCEPTION 'A valid service quantity is required.';
    END IF;
    v_min := NULLIF(v_config.measurement_config #>> '{quantity,min}', '')::numeric;
    v_max := NULLIF(v_config.measurement_config #>> '{quantity,max}', '')::numeric;
    IF v_min IS NOT NULL AND p_quantity < v_min THEN
      RAISE EXCEPTION 'The submitted quantity is below the service minimum of %.', v_min;
    END IF;
    IF v_max IS NOT NULL AND p_quantity > v_max THEN
      RAISE EXCEPTION 'The submitted quantity exceeds the service maximum of %.', v_max;
    END IF;
  END IF;

  FOR v_question IN
    SELECT q.* FROM public.booking_engine_questions q
    WHERE q.service_config_id = p_service_config_id AND q.active IS TRUE
    ORDER BY q.display_order, q.created_at
  LOOP
    v_answer := p_answers -> v_question.question_key;
    v_visible := true;
    v_required := COALESCE(v_question.required, false);

    FOR v_condition IN
      SELECT c.*, dq.question_key AS depends_on_question_key
      FROM public.booking_engine_question_conditions c
      JOIN public.booking_engine_questions dq
        ON dq.id = c.depends_on_question_id AND dq.active IS TRUE
      WHERE c.question_id = v_question.id
      ORDER BY c.created_at, c.id
    LOOP
      v_dependency_answer := p_answers -> v_condition.depends_on_question_key;
      v_actual := CASE
        WHEN v_dependency_answer IS NULL OR v_dependency_answer = 'null'::jsonb THEN ''
        WHEN jsonb_typeof(v_dependency_answer) = 'string' THEN v_dependency_answer #>> '{}'
        ELSE v_dependency_answer::text
      END;
      v_expected := COALESCE(
        v_condition.expected_value #>> '{}',
        trim(both '"' from v_condition.expected_value::text)
      );
      v_match := CASE v_condition.operator
        WHEN 'equals' THEN v_actual = v_expected
        WHEN 'not_equals' THEN v_actual <> v_expected
        WHEN 'greater_than' THEN
          CASE WHEN v_actual ~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$'
                 AND v_expected ~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$'
            THEN v_actual::numeric > v_expected::numeric ELSE false END
        WHEN 'less_than' THEN
          CASE WHEN v_actual ~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$'
                 AND v_expected ~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$'
            THEN v_actual::numeric < v_expected::numeric ELSE false END
        WHEN 'contains' THEN
          CASE WHEN jsonb_typeof(v_dependency_answer) = 'array'
            THEN v_dependency_answer ? v_expected
            ELSE position(v_expected in v_actual) > 0 END
        ELSE false
      END;
      IF v_condition.action = 'show' THEN v_visible := v_match; END IF;
      IF v_condition.action = 'hide' AND v_match THEN v_visible := false; END IF;
      IF v_condition.action = 'required' THEN v_required := v_match; END IF;
      IF v_condition.action = 'optional' AND v_match THEN v_required := false; END IF;
    END LOOP;

    IF v_visible AND v_required AND (
      v_answer IS NULL OR v_answer = 'null'::jsonb OR v_answer = '""'::jsonb
      OR v_answer = '[]'::jsonb
      OR (jsonb_typeof(v_answer) = 'string' AND btrim(v_answer #>> '{}') = '')
    ) THEN
      RAISE EXCEPTION 'Please answer the required service question: %.', v_question.label;
    END IF;

    IF NOT v_visible OR v_answer IS NULL OR v_answer = 'null'::jsonb
       OR v_answer = '""'::jsonb OR v_answer = '[]'::jsonb THEN
      CONTINUE;
    END IF;

    IF jsonb_typeof(v_question.validation_rules) <> 'object' THEN
      RAISE EXCEPTION 'Question validation for "%" is not configured correctly.', v_question.label;
    END IF;

    v_min := NULLIF(v_question.validation_rules->>'min', '')::numeric;
    v_max := NULLIF(v_question.validation_rules->>'max', '')::numeric;
    v_min_length := NULLIF(v_question.validation_rules->>'min_length', '')::integer;
    v_max_length := NULLIF(v_question.validation_rules->>'max_length', '')::integer;

    IF v_question.input_type IN ('number', 'measurement') THEN
      v_answer_text := CASE WHEN jsonb_typeof(v_answer) = 'string' THEN v_answer #>> '{}' ELSE v_answer::text END;
      IF v_answer_text !~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' THEN
        RAISE EXCEPTION 'Enter a valid number for "%".', v_question.label;
      END IF;
      IF v_min IS NOT NULL AND v_answer_text::numeric < v_min THEN
        RAISE EXCEPTION '"%" must be at least %.', v_question.label, v_min;
      END IF;
      IF v_max IS NOT NULL AND v_answer_text::numeric > v_max THEN
        RAISE EXCEPTION '"%" must be no more than %.', v_question.label, v_max;
      END IF;
    ELSIF v_question.input_type = 'boolean' THEN
      IF jsonb_typeof(v_answer) <> 'boolean' THEN
        RAISE EXCEPTION 'Choose yes or no for "%".', v_question.label;
      END IF;
    ELSIF v_question.input_type IN ('select', 'multi_select') THEN
      IF (v_question.input_type = 'select' AND jsonb_typeof(v_answer) <> 'string')
         OR (v_question.input_type = 'multi_select' AND jsonb_typeof(v_answer) <> 'array') THEN
        RAISE EXCEPTION 'Choose a valid option for "%".', v_question.label;
      END IF;
      IF v_question.input_type = 'select' THEN
        v_valid := false;
        FOR v_option IN SELECT value FROM jsonb_array_elements(COALESCE(v_question.options, '[]'::jsonb))
        LOOP
          IF v_option->>'value' = v_answer #>> '{}'
             OR v_option->>'id' = v_answer #>> '{}'
             OR v_option->>'label' = v_answer #>> '{}'
             OR (jsonb_typeof(v_option) = 'string' AND v_option #>> '{}' = v_answer #>> '{}') THEN
            v_valid := true;
          END IF;
        END LOOP;
        IF NOT v_valid THEN RAISE EXCEPTION 'Choose a valid option for "%".', v_question.label; END IF;
      ELSE
        FOR v_selected IN SELECT value FROM jsonb_array_elements(v_answer)
        LOOP
          v_valid := false;
          FOR v_option IN SELECT value FROM jsonb_array_elements(COALESCE(v_question.options, '[]'::jsonb))
          LOOP
            IF v_option->>'value' = v_selected #>> '{}'
               OR v_option->>'id' = v_selected #>> '{}'
               OR v_option->>'label' = v_selected #>> '{}'
               OR (jsonb_typeof(v_option) = 'string' AND v_option #>> '{}' = v_selected #>> '{}') THEN
              v_valid := true;
            END IF;
          END LOOP;
          IF NOT v_valid THEN RAISE EXCEPTION 'One or more options are invalid for "%".', v_question.label; END IF;
        END LOOP;
      END IF;
    ELSE
      IF jsonb_typeof(v_answer) <> 'string' THEN
        RAISE EXCEPTION 'Enter text for "%".', v_question.label;
      END IF;
      v_answer_text := v_answer #>> '{}';
      IF v_min_length IS NOT NULL AND char_length(v_answer_text) < v_min_length THEN
        RAISE EXCEPTION '"%" must contain at least % characters.', v_question.label, v_min_length;
      END IF;
      IF v_max_length IS NOT NULL AND char_length(v_answer_text) > v_max_length THEN
        RAISE EXCEPTION '"%" must contain no more than % characters.', v_question.label, v_max_length;
      END IF;
      IF NULLIF(v_question.validation_rules->>'pattern', '') IS NOT NULL
         AND v_answer_text !~ (v_question.validation_rules->>'pattern') THEN
        RAISE EXCEPTION '"%" does not match the required format.', v_question.label;
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_guest_booking_engine_answers(uuid, jsonb, numeric)
  FROM PUBLIC, anon, authenticated;

-- Convert the public enquiry into a native Booking Engine request. No prices
-- or service labels from the browser are trusted; all are resolved server-side.
CREATE OR REPLACE FUNCTION public.convert_guest_service_request_to_booking_engine_request(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_guest public.guest_service_requests%ROWTYPE;
  v_service record;
  v_config public.booking_engine_service_config%ROWTYPE;
  v_client_id uuid;
  v_request_id uuid;
  v_request_number text;
  v_item_id uuid;
  v_details jsonb;
  v_answers jsonb;
  v_measurements jsonb;
  v_selected_extras jsonb;
  v_extra text;
  v_selected_offer_id uuid;
  v_offer_type text;
  v_offer_updated_at timestamptz;
  v_addon_offer_id uuid;
  v_addon_offer_type text;
  v_addon_offer_updated_at timestamptz;
  v_quantity numeric;
  v_price jsonb;
  v_scope_snapshot jsonb;
  v_staff_name text;
  v_staff_role text;
  v_selected_scope_ids text[];
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and super admins may convert a guest request into Smart Booking.';
  END IF;

  SELECT * INTO v_guest
  FROM public.guest_service_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Guest service request not found.'; END IF;

  IF v_guest.booking_engine_request_id IS NOT NULL THEN
    SELECT request_number INTO v_request_number
    FROM public.booking_engine_requests
    WHERE id = v_guest.booking_engine_request_id;
    IF v_request_number IS NULL THEN
      RAISE EXCEPTION 'The linked Smart Booking request could not be found.';
    END IF;
    RETURN jsonb_build_object(
      'status', 'already_converted',
      'guest_request_id', v_guest.id,
      'booking_engine_request_id', v_guest.booking_engine_request_id,
      'request_number', v_request_number,
      'booking_engine_status', v_guest.booking_engine_status
    );
  END IF;

  IF v_guest.status IN ('rejected', 'closed') THEN
    RAISE EXCEPTION 'Rejected or closed guest requests cannot be converted.';
  END IF;

  IF v_guest.lead_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.booking_engine_requests r WHERE r.lead_id = v_guest.lead_id
  ) THEN
    RAISE EXCEPTION 'This CRM lead is already linked to another Smart Booking request. Review the existing request to avoid duplicates.';
  END IF;

  v_details := COALESCE(v_guest.booking_details_snapshot, '{}'::jsonb);
  IF COALESCE(v_details->>'legacy_request', 'false') = 'true'
     OR NULLIF(v_details->>'service_config_version', '') IS NULL THEN
    RAISE EXCEPTION 'This guest request was submitted through the standard guest form and has no guided Smart Booking snapshot. Convert it to a CRM lead or enable guided booking for this service before Smart Booking conversion.';
  END IF;
  IF jsonb_typeof(v_details) <> 'object'
     OR jsonb_typeof(v_details->'answers') <> 'object'
     OR jsonb_typeof(v_details->'measurements') <> 'object'
     OR jsonb_typeof(v_details->'selected_extras') <> 'array'
     OR jsonb_typeof(v_details->'selected_offer_versions') <> 'object' THEN
    RAISE EXCEPTION 'This guest request does not contain complete guided booking details. Ask the customer to resubmit.';
  END IF;

  IF v_guest.service_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'The requested service reference is invalid.';
  END IF;

  SELECT s.id, s.name, s.is_active
  INTO v_service
  FROM public.services s
  WHERE s.id = v_guest.service_id::uuid
  FOR SHARE;

  IF NOT FOUND OR v_service.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'The requested service is no longer active. Review the enquiry before proceeding.';
  END IF;

  SELECT * INTO v_config
  FROM public.booking_engine_service_config
  WHERE service_id = v_service.id AND enabled IS TRUE
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The service is not currently enabled for Smart Booking. Review it manually before proceeding.';
  END IF;

  IF COALESCE(NULLIF(v_details->>'service_config_version', '')::integer, -1)
     IS DISTINCT FROM v_config.config_version THEN
    RAISE EXCEPTION 'The service setup changed after this guest request was submitted. Review the answers and ask the guest to confirm updated requirements.';
  END IF;

  v_answers := v_details->'answers';
  v_measurements := v_details->'measurements';
  v_selected_extras := v_details->'selected_extras';
  v_quantity := NULLIF(v_details->>'quantity', '')::numeric;
  v_selected_offer_id := NULLIF(v_details->>'selected_offer_id', '')::uuid;

  PERFORM public.assert_guest_booking_engine_answers(v_config.id, v_answers, v_quantity);

  v_selected_scope_ids := ARRAY[]::text[];
  FOR v_extra IN SELECT value FROM jsonb_array_elements_text(v_selected_extras)
  LOOP
    IF left(v_extra, 6) = 'offer:' THEN
      IF substring(v_extra FROM 7) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'One of the selected add-ons is invalid. Refresh the booking form and try again.';
      END IF;
      v_addon_offer_id := substring(v_extra FROM 7)::uuid;
      SELECT o.offer_type, o.updated_at
      INTO v_addon_offer_type, v_addon_offer_updated_at
      FROM public.booking_engine_value_offers o
      WHERE o.id = v_addon_offer_id
        AND o.active IS TRUE
        AND (o.starts_at IS NULL OR o.starts_at <= now())
        AND (o.ends_at IS NULL OR o.ends_at > now())
      FOR SHARE;
      IF v_addon_offer_type IS DISTINCT FROM 'add_on'
         AND v_addon_offer_type IS DISTINCT FROM 'upgrade' THEN
        RAISE EXCEPTION 'A selected optional extra is no longer an active add-on or upgrade.';
      END IF;
      IF v_addon_offer_updated_at IS DISTINCT FROM
        NULLIF(v_details->'selected_offer_versions'->>v_addon_offer_id::text, '')::timestamptz THEN
        RAISE EXCEPTION 'A selected add-on has changed since the guest submitted the request. Ask the guest to review it again.';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.booking_engine_value_offer_services l
        WHERE l.offer_id = v_addon_offer_id
          AND l.service_id = v_service.id
          AND l.relationship = 'trigger'
      ) THEN
        RAISE EXCEPTION 'A selected add-on no longer applies to the requested service.';
      END IF;
    ELSE
      IF v_extra !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         OR NOT EXISTS (
           SELECT 1 FROM public.booking_engine_service_scope sc
           WHERE sc.id = v_extra::uuid
             AND sc.service_config_id = v_config.id
             AND sc.scope_type = 'extra'
             AND sc.active IS TRUE
         ) THEN
        RAISE EXCEPTION 'One of the selected additional scope items is no longer available. Review the guest request.';
      END IF;
      v_selected_scope_ids := array_append(v_selected_scope_ids, v_extra);
    END IF;
  END LOOP;

  IF v_selected_offer_id IS NOT NULL THEN
    SELECT offer_type, updated_at INTO v_offer_type, v_offer_updated_at
    FROM public.booking_engine_value_offers
    WHERE id = v_selected_offer_id AND active IS TRUE
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at > now())
    FOR SHARE;
    IF v_offer_type IS DISTINCT FROM 'package' OR v_offer_updated_at IS DISTINCT FROM
      NULLIF(v_details->'selected_offer_versions'->>v_selected_offer_id::text, '')::timestamptz THEN
      RAISE EXCEPTION 'The selected package has changed or expired since the guest submitted the request. Ask the guest to review the updated package.';
    END IF;
  END IF;

  -- Match Kenyan mobile numbers across local 07/01 and +254 formats
  -- before calling the existing CRM resolver, avoiding duplicate client rows.
  SELECT c.id INTO v_client_id
  FROM public.clients c
  WHERE (
    CASE
      WHEN regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') LIKE '0%'
        THEN '254' || substring(regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') FROM 2)
      ELSE regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g')
    END
  ) = (
    CASE
      WHEN regexp_replace(COALESCE(v_guest.customer_phone, ''), '[^0-9]', '', 'g') LIKE '0%'
        THEN '254' || substring(regexp_replace(COALESCE(v_guest.customer_phone, ''), '[^0-9]', '', 'g') FROM 2)
      ELSE regexp_replace(COALESCE(v_guest.customer_phone, ''), '[^0-9]', '', 'g')
    END
  )
  ORDER BY c.created_at
  LIMIT 1
  FOR UPDATE;

  IF v_client_id IS NULL THEN
    SELECT client_id INTO v_client_id
    FROM public.resolve_booking_client(
      v_guest.customer_name,
      v_guest.customer_phone,
      v_guest.location,
      'admin'
    );
  END IF;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'The guest could not be linked to a CRM client record.';
  END IF;

  INSERT INTO public.booking_engine_requests (
    customer_id, customer_user_id, lead_id, status, requested_date, requested_time,
    service_location, customer_notes, customer_acknowledged_scope
  )
  VALUES (
    v_client_id, NULL, v_guest.lead_id, 'draft', v_guest.preferred_date, v_guest.preferred_time,
    v_guest.location, v_guest.customer_notes, false
  )
  RETURNING id, request_number INTO v_request_id, v_request_number;

  SELECT jsonb_build_object(
    'configuration_version', v_config.config_version,
    'included', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', sc.id, 'title', sc.title, 'description', sc.description)
        ORDER BY sc.display_order, sc.created_at)
      FROM public.booking_engine_service_scope sc
      WHERE sc.service_config_id = v_config.id AND sc.scope_type = 'included' AND sc.active IS TRUE
    ), '[]'::jsonb),
    'excluded', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', sc.id, 'title', sc.title, 'description', sc.description)
        ORDER BY sc.display_order, sc.created_at)
      FROM public.booking_engine_service_scope sc
      WHERE sc.service_config_id = v_config.id AND sc.scope_type = 'excluded' AND sc.active IS TRUE
    ), '[]'::jsonb),
    'selected_extras', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', sc.id, 'title', sc.title, 'description', sc.description)
        ORDER BY sc.display_order, sc.created_at)
      FROM public.booking_engine_service_scope sc
      WHERE sc.service_config_id = v_config.id AND sc.scope_type = 'extra'
        AND sc.active IS TRUE AND sc.id::text = ANY(v_selected_scope_ids)
    ), '[]'::jsonb),
    'photo_mode', v_config.photo_mode,
    'photo_min', v_config.photo_min,
    'photo_max', v_config.photo_max,
    'guest_photo_follow_up_required', v_config.photo_mode = 'required'
  ) INTO v_scope_snapshot;

  INSERT INTO public.booking_engine_request_items (
    request_id, service_id, service_config_id, display_order, quantity,
    measurements, answers, selected_extras, pricing_snapshot, scope_snapshot,
    service_config_version
  )
  VALUES (
    v_request_id, v_service.id, v_config.id, 0,
    CASE WHEN COALESCE((v_config.measurement_config #>> '{quantity,enabled}')::boolean, false)
      THEN v_quantity ELSE NULL END,
    v_measurements, v_answers, v_selected_extras, '{}'::jsonb, v_scope_snapshot,
    v_config.config_version
  )
  RETURNING id INTO v_item_id;

  IF v_selected_offer_id IS NOT NULL THEN
    PERFORM public.set_booking_engine_request_offer(v_request_id, v_item_id, v_selected_offer_id);
  END IF;

  v_price := public.calculate_booking_engine_item_price(v_item_id);
  IF COALESCE(v_price->>'status', '') NOT IN ('priced', 'quotation_required') THEN
    RAISE EXCEPTION 'The current Smart Booking pricing rules could not calculate this request. Review the service configuration before proceeding.';
  END IF;

  UPDATE public.booking_engine_requests
  SET status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  WHERE id = v_request_id;

  SELECT p.full_name, ur.role::text
  INTO v_staff_name, v_staff_role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  ORDER BY CASE WHEN ur.role::text = 'super_admin' THEN 0 ELSE 1 END
  LIMIT 1;

  INSERT INTO public.booking_engine_request_events (
    request_id, event_type, from_status, to_status, message,
    actor_user_id, actor_name, actor_role, metadata
  )
  VALUES (
    v_request_id, 'submitted', 'draft', 'submitted',
    'Guest request ' || v_guest.request_reference || ' imported into the native Smart Booking workflow for staff review.',
    auth.uid(), COALESCE(v_staff_name, 'Admin'), COALESCE(v_staff_role, 'admin'),
    jsonb_build_object('guest_request_id', v_guest.id, 'guest_reference', v_guest.request_reference)
  );

  UPDATE public.guest_service_requests
  SET booking_engine_request_id = v_request_id,
      booking_engine_request_number = v_request_number,
      booking_engine_status = 'submitted',
      status = 'under_review',
      estimated_amount = CASE WHEN v_price->>'status' = 'priced'
        THEN COALESCE(NULLIF(v_price->>'total', '')::numeric, estimated_amount)
        ELSE estimated_amount END,
      discount_amount = CASE WHEN v_price->>'status' = 'priced'
        THEN COALESCE(NULLIF(v_price->>'discount_amount', '')::numeric, discount_amount)
        ELSE discount_amount END,
      updated_at = now()
  WHERE id = v_guest.id;

  RETURN jsonb_build_object(
    'status', 'submitted',
    'guest_request_id', v_guest.id,
    'booking_engine_request_id', v_request_id,
    'request_number', v_request_number,
    'pricing_status', v_price->>'status',
    'estimated_amount', v_price->'total'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_guest_service_request_to_booking_engine_request(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_guest_service_request_to_booking_engine_request(uuid)
  TO authenticated;

-- For an automatically priced guest quotation request, create the formal
-- quotation from the same frozen native Booking Engine snapshots.
-- If staff pricing is required, the existing Booking Engine quotation screen
-- remains the authority and this helper deliberately refuses to guess.
CREATE OR REPLACE FUNCTION public.prepare_guest_service_request_quotation(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_guest public.guest_service_requests%ROWTYPE;
  v_request public.booking_engine_requests%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_staff_name text;
  v_staff_role text;
  v_price_result jsonb;
  v_subtotal numeric;
  v_discount numeric;
  v_total numeric;
  v_line_items jsonb;
  v_service_name text;
  v_quotation_id uuid;
  v_quotation_number text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and super admins may prepare guest quotations.';
  END IF;

  SELECT * INTO v_guest
  FROM public.guest_service_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_guest.request_type <> 'quotation' THEN
    RAISE EXCEPTION 'A linked guest quotation request could not be found.';
  END IF;
  IF v_guest.status IN ('rejected', 'closed') THEN
    RAISE EXCEPTION 'Rejected or closed guest requests cannot be quoted.';
  END IF;

  IF v_guest.quotation_id IS NOT NULL THEN
    SELECT quotation_number INTO v_quotation_number
    FROM public.quotations WHERE id = v_guest.quotation_id;
    RETURN jsonb_build_object(
      'status', 'already_prepared',
      'quotation_id', v_guest.quotation_id,
      'quotation_number', v_quotation_number
    );
  END IF;

  IF v_guest.booking_engine_request_id IS NULL THEN
    RAISE EXCEPTION 'Convert this guest request into Smart Booking before preparing a quotation.';
  END IF;

  SELECT * INTO v_request
  FROM public.booking_engine_requests
  WHERE id = v_guest.booking_engine_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.customer_id IS NULL THEN
    RAISE EXCEPTION 'The linked Smart Booking request or CRM client is unavailable.';
  END IF;

  v_price_result := public.calculate_booking_engine_request_price(v_request.id);
  IF COALESCE(v_price_result->>'status', '') <> 'priced' THEN
    RAISE EXCEPTION 'This request needs staff-entered pricing. Open it in Smart Booking and use the manual quotation workflow.';
  END IF;

  SELECT c.* INTO v_client
  FROM public.clients c
  WHERE c.id = v_request.customer_id
  FOR SHARE;

  IF v_client.id IS NULL THEN RAISE EXCEPTION 'The linked CRM client could not be found.'; END IF;

  SELECT p.full_name, ur.role::text
  INTO v_staff_name, v_staff_role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  ORDER BY CASE WHEN ur.role::text = 'super_admin' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_staff_role IS NULL THEN
    RAISE EXCEPTION 'The reviewing staff profile or role could not be determined.';
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(NULLIF(pricing_snapshot->>'subtotal', '')::numeric, 0)), 0),
    COALESCE(SUM(COALESCE(NULLIF(pricing_snapshot->>'discount_amount', '')::numeric, 0)), 0),
    COALESCE(SUM(COALESCE(NULLIF(pricing_snapshot->>'total', '')::numeric, 0)), 0)
  INTO v_subtotal, v_discount, v_total
  FROM public.booking_engine_request_items
  WHERE request_id = v_request.id
    AND pricing_snapshot->>'status' = 'priced';

  SELECT s.name INTO v_service_name
  FROM public.booking_engine_request_items ri
  JOIN public.services s ON s.id = ri.service_id
  WHERE ri.request_id = v_request.id
  ORDER BY ri.display_order, ri.created_at
  LIMIT 1;

  v_line_items := public.booking_engine_expand_offer_line_items(v_request.id);
  v_quotation_number := public.next_quotation_number();

  INSERT INTO public.quotations (
    quotation_number, client_id, client_name, client_phone, service_name,
    service_date, price, created_by, created_by_name, created_by_role,
    salesperson_id, salesperson_name, salesperson_role, line_items,
    subtotal, discount_amount, discount_reason, local_id
  )
  VALUES (
    v_quotation_number, v_client.id, v_client.full_name, v_client.phone,
    COALESCE(v_service_name, 'Cleaning Service'), v_request.requested_date,
    v_total, auth.uid(), v_staff_name, v_staff_role,
    auth.uid(), v_staff_name, v_staff_role, v_line_items,
    v_subtotal, v_discount,
    CASE WHEN v_discount > 0 THEN 'Smart Booking approved promotion pricing' ELSE NULL END,
    'BE-' || v_request.id::text
  )
  RETURNING id INTO v_quotation_id;

  IF v_request.status = 'submitted' THEN
    PERFORM public.transition_booking_engine_request_admin(v_request.id, 'under_review', 'Guest quotation reviewed by staff.');
    v_request.status := 'under_review';
  END IF;

  IF v_request.status IN ('under_review', 'approved') THEN
    PERFORM public.transition_booking_engine_request_admin(v_request.id, 'quote_required', 'Guest requested a formal quotation.');
    v_request.status := 'quote_required';
  END IF;

  IF v_request.status <> 'quote_required' THEN
    RAISE EXCEPTION 'The linked Smart Booking request is not in a quotation-preparation state.';
  END IF;

  UPDATE public.booking_engine_requests
  SET quotation_id = v_quotation_id,
      status = 'quote_prepared',
      updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.booking_engine_request_events (
    request_id, event_type, from_status, to_status, message,
    actor_user_id, actor_name, actor_role, metadata
  )
  VALUES (
    v_request.id, 'quote_prepared', 'quote_required', 'quote_prepared',
    'Formal guest quotation prepared from trusted Smart Booking pricing snapshots.',
    auth.uid(), v_staff_name, v_staff_role,
    jsonb_build_object('quotation_id', v_quotation_id, 'quotation_number', v_quotation_number, 'total', v_total)
  );

  UPDATE public.guest_service_requests
  SET quotation_id = v_quotation_id, booking_engine_status = 'quote_prepared', updated_at = now()
  WHERE id = v_guest.id;

  RETURN jsonb_build_object(
    'status', 'quote_prepared',
    'quotation_id', v_quotation_id,
    'quotation_number', v_quotation_number,
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_guest_service_request_quotation(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_guest_service_request_quotation(uuid)
  TO authenticated;

-- Record a guest's verbal/WhatsApp confirmation as a staff-audited action.
-- Guests do not receive customer-account access or downloadable ERP documents.
CREATE OR REPLACE FUNCTION public.confirm_guest_service_request_customer_response(
  p_request_id uuid,
  p_channel text DEFAULT 'whatsapp'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_guest public.guest_service_requests%ROWTYPE;
  v_request public.booking_engine_requests%ROWTYPE;
  v_staff_name text;
  v_staff_role text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and super admins may record guest confirmation.';
  END IF;
  IF p_channel IS NULL OR p_channel NOT IN ('whatsapp', 'phone', 'email', 'in_person') THEN
    RAISE EXCEPTION 'Choose a valid customer confirmation channel.';
  END IF;

  SELECT * INTO v_guest FROM public.guest_service_requests
  WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_guest.booking_engine_request_id IS NULL THEN
    RAISE EXCEPTION 'The linked Smart Booking request could not be found.';
  END IF;
  IF v_guest.status IN ('rejected', 'closed') THEN
    RAISE EXCEPTION 'Rejected or closed guest requests cannot be confirmed.';
  END IF;

  SELECT * INTO v_request FROM public.booking_engine_requests
  WHERE id = v_guest.booking_engine_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The linked Smart Booking request could not be found.'; END IF;

  IF v_request.status NOT IN ('approved', 'quote_prepared', 'customer_accepted', 'ready_for_booking') THEN
    RAISE EXCEPTION 'The request must be approved or have a prepared quotation before customer confirmation.';
  END IF;

  IF v_guest.request_type = 'quotation' AND v_request.quotation_id IS NULL THEN
    RAISE EXCEPTION 'Prepare and link the formal quotation before recording guest acceptance.';
  END IF;

  IF v_guest.customer_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_confirmed',
      'guest_request_id', v_guest.id,
      'booking_engine_request_id', v_request.id,
      'confirmed_at', v_guest.customer_confirmed_at,
      'channel', v_guest.customer_confirmation_channel
    );
  END IF;

  SELECT p.full_name, ur.role::text
  INTO v_staff_name, v_staff_role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  ORDER BY CASE WHEN ur.role::text = 'super_admin' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_staff_role IS NULL THEN RAISE EXCEPTION 'The staff profile or role could not be determined.'; END IF;

  IF v_request.status = 'quote_prepared' THEN
    UPDATE public.booking_engine_requests
    SET status = 'customer_accepted', customer_acknowledged_scope = true,
        scope_acknowledged_at = now(), updated_at = now()
    WHERE id = v_request.id;

    INSERT INTO public.booking_engine_request_events (
      request_id, event_type, from_status, to_status, message,
      actor_user_id, actor_name, actor_role, metadata
    )
    VALUES (
      v_request.id, 'customer_accepted', 'quote_prepared', 'customer_accepted',
      'Guest confirmed the prepared quotation through the recorded staff follow-up channel.',
      auth.uid(), v_staff_name, v_staff_role,
      jsonb_build_object('channel', p_channel, 'confirmed_at', now(), 'recorded_by_staff', true)
    );
  ELSE
    UPDATE public.booking_engine_requests
    SET customer_acknowledged_scope = true,
        scope_acknowledged_at = COALESCE(scope_acknowledged_at, now()),
        updated_at = now()
    WHERE id = v_request.id;

    INSERT INTO public.booking_engine_request_events (
      request_id, event_type, from_status, to_status, message,
      actor_user_id, actor_name, actor_role, metadata
    )
    VALUES (
      v_request.id, 'customer_accepted', v_request.status, v_request.status,
      'Guest confirmed the reviewed service scope and price through the recorded staff follow-up channel.',
      auth.uid(), v_staff_name, v_staff_role,
      jsonb_build_object('channel', p_channel, 'confirmed_at', now(), 'recorded_by_staff', true)
    );
  END IF;

  UPDATE public.guest_service_requests
  SET customer_confirmed_at = COALESCE(customer_confirmed_at, now()),
      customer_confirmed_by = auth.uid(),
      customer_confirmation_channel = p_channel,
      updated_at = now()
  WHERE id = v_guest.id;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_request.status = 'quote_prepared' THEN 'customer_accepted' ELSE v_request.status END,
    'guest_request_id', v_guest.id,
    'booking_engine_request_id', v_request.id,
    'confirmed_at', now(),
    'channel', p_channel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_guest_service_request_customer_response(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_guest_service_request_customer_response(uuid, text)
  TO authenticated;

-- The existing ERP conversion function remains the single booking creator.
-- Permit its existing admin caller to convert a request whose customer_user_id
-- is NULL (a guest), without weakening authenticated-customer ownership checks.
DO $$
DECLARE
  v_definition text;
  v_updated text;
BEGIN
  IF to_regprocedure('public.convert_booking_engine_request_base(uuid)') IS NULL THEN
    RAISE EXCEPTION 'The expected native Smart Booking conversion function is missing.';
  END IF;

  v_definition := pg_get_functiondef('public.convert_booking_engine_request_base(uuid)'::regprocedure);
  v_updated := replace(
    v_definition,
    'IF v_request.customer_user_id IS DISTINCT FROM auth.uid() THEN',
    'IF v_request.customer_user_id IS DISTINCT FROM auth.uid() AND NOT (v_request.customer_user_id IS NULL AND public.is_admin_or_super(auth.uid())) THEN'
  );

  IF v_updated = v_definition
     AND position('v_request.customer_user_id IS NULL AND public.is_admin_or_super(auth.uid())' in v_definition) = 0 THEN
    RAISE EXCEPTION 'Could not safely extend native Smart Booking conversion for guest-owned requests.';
  END IF;

  IF v_updated <> v_definition THEN
    EXECUTE v_updated;
  END IF;
END;
$$;

-- Prevent a guest quotation request from bypassing formal quotation preparation.
CREATE OR REPLACE FUNCTION public.prevent_guest_quotation_ready_without_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'ready_for_booking'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.customer_user_id IS NULL
     AND EXISTS (
       SELECT 1
       FROM public.guest_service_requests g
       WHERE g.booking_engine_request_id = NEW.id
         AND g.request_type = 'quotation'
         AND g.quotation_id IS NULL
     ) THEN
    RAISE EXCEPTION 'Prepare and link the guest quotation before approving this request for booking.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_guest_quotation_ready_without_quote()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_guest_quotation_ready_without_quote
  ON public.booking_engine_requests;
CREATE TRIGGER trg_prevent_guest_quotation_ready_without_quote
BEFORE UPDATE OF status ON public.booking_engine_requests
FOR EACH ROW
EXECUTE FUNCTION public.prevent_guest_quotation_ready_without_quote();

-- Keep the guest enquiry row synchronized with the native request, quotation
-- and final ERP booking while preserving the original enquiry and its audit trail.
CREATE OR REPLACE FUNCTION public.sync_guest_service_request_booking_engine_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.guest_service_requests g
  SET booking_engine_status = NEW.status::text,
      quotation_id = NEW.quotation_id,
      converted_booking_id = NEW.converted_booking_id,
      lead_id = CASE
        WHEN NEW.converted_booking_id IS NOT NULL AND NEW.lead_id IS NOT NULL THEN NEW.lead_id
        ELSE g.lead_id
      END,
      status = CASE
        WHEN NEW.converted_booking_id IS NOT NULL AND NEW.lead_id IS NOT NULL THEN 'converted_to_lead'
        ELSE g.status
      END,
      converted_at = CASE
        WHEN NEW.converted_booking_id IS NOT NULL AND NEW.lead_id IS NOT NULL THEN COALESCE(g.converted_at, now())
        ELSE g.converted_at
      END,
      updated_at = now()
  WHERE g.booking_engine_request_id = NEW.id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_guest_service_request_booking_engine_state()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_guest_service_request_booking_engine_state
  ON public.booking_engine_requests;
CREATE TRIGGER trg_sync_guest_service_request_booking_engine_state
AFTER UPDATE OF status, quotation_id, converted_booking_id, lead_id
ON public.booking_engine_requests
FOR EACH ROW
EXECUTE FUNCTION public.sync_guest_service_request_booking_engine_state();

-- A final staff approval/confirmation creates exactly one existing ERP booking.
CREATE OR REPLACE FUNCTION public.convert_guest_service_request_to_erp_booking(
  p_guest_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_guest public.guest_service_requests%ROWTYPE;
  v_request public.booking_engine_requests%ROWTYPE;
  v_result jsonb;
  v_lead_id uuid;
  v_staff_name text;
  v_staff_role text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and super admins may create an ERP booking from a guest request.';
  END IF;

  SELECT * INTO v_guest
  FROM public.guest_service_requests
  WHERE id = p_guest_request_id
  FOR UPDATE;
  IF NOT FOUND OR v_guest.booking_engine_request_id IS NULL THEN
    RAISE EXCEPTION 'The guest request has not been converted into Smart Booking.';
  END IF;
  IF v_guest.status IN ('rejected', 'closed') THEN
    RAISE EXCEPTION 'Rejected or closed guest requests cannot become ERP bookings.';
  END IF;

  IF v_guest.converted_booking_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_converted',
      'guest_request_id', v_guest.id,
      'booking_id', v_guest.converted_booking_id
    );
  END IF;

  IF v_guest.customer_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Record the guest''s confirmation of the reviewed price and service scope before creating the ERP booking.';
  END IF;

  IF v_guest.request_type = 'quotation' AND v_guest.quotation_id IS NULL THEN
    RAISE EXCEPTION 'A formal quotation must be linked before a quotation request can become an ERP booking.';
  END IF;

  SELECT p.full_name, ur.role::text
  INTO v_staff_name, v_staff_role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
  ORDER BY CASE WHEN ur.role::text = 'super_admin' THEN 0 ELSE 1 END
  LIMIT 1;
  IF v_staff_role IS NULL THEN RAISE EXCEPTION 'The approving staff profile or role could not be determined.'; END IF;

  SELECT * INTO v_request
  FROM public.booking_engine_requests
  WHERE id = v_guest.booking_engine_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The linked Smart Booking request could not be found.'; END IF;

  IF v_request.customer_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'This linked request belongs to an authenticated customer and must use the normal customer conversion workflow.';
  END IF;

  IF v_request.status IN ('approved', 'customer_accepted') THEN
    UPDATE public.booking_engine_requests
    SET status = 'ready_for_booking', updated_at = now()
    WHERE id = v_request.id;

    INSERT INTO public.booking_engine_request_events (
      request_id, event_type, from_status, to_status, message,
      actor_user_id, actor_name, actor_role, metadata
    )
    SELECT
      v_request.id, 'ready_for_booking', v_request.status, 'ready_for_booking',
      'Staff approved the guest-confirmed request for ERP booking conversion.',
      auth.uid(), v_staff_name, v_staff_role,
      jsonb_build_object('guest_request_id', v_guest.id, 'approved_at', now())
    ;
  ELSIF v_request.status <> 'ready_for_booking' THEN
    RAISE EXCEPTION 'The Smart Booking request must be approved or customer-accepted before ERP conversion. Current status: %.', v_request.status;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_engine_request_items ri
    JOIN public.booking_engine_service_config c ON c.id = ri.service_config_id
    WHERE ri.request_id = v_request.id
      AND (
        (c.photo_mode = 'required' AND (
          SELECT count(*) FROM public.booking_engine_request_photos p
          WHERE p.request_id = ri.request_id AND p.request_item_id = ri.id
        ) < GREATEST(COALESCE(c.photo_min, 1), 1))
        OR (c.photo_max > 0 AND (
          SELECT count(*) FROM public.booking_engine_request_photos p
          WHERE p.request_id = ri.request_id AND p.request_item_id = ri.id
        ) > c.photo_max)
      )
  ) THEN
    RAISE EXCEPTION 'Required service photos are missing or exceed the configured limit. Collect and attach the correct photos before creating the ERP booking.';
  END IF;

  v_result := public.convert_booking_engine_request(v_request.id);
  IF COALESCE(v_result->>'booking_id', '') = '' THEN
    RAISE EXCEPTION 'The existing ERP booking workflow did not return a booking reference.';
  END IF;

  UPDATE public.bookings
  SET created_by_name = v_staff_name,
      created_by_role = v_staff_role,
      updated_at = now()
  WHERE id = NULLIF(v_result->>'booking_id', '')::uuid;

  UPDATE public.booking_engine_request_events
  SET actor_name = v_staff_name,
      actor_role = v_staff_role,
      message = 'Guest request converted to the existing ERP booking workflow by authorized staff.'
  WHERE request_id = v_request.id
    AND event_type = 'converted'
    AND metadata->>'booking_id' = v_result->>'booking_id';

  SELECT lead_id INTO v_lead_id
  FROM public.booking_engine_requests
  WHERE id = v_request.id;
  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'The ERP booking was created but the expected CRM lead link is missing. The transaction has been rolled back.';
  END IF;

  UPDATE public.guest_service_requests
  SET status = CASE WHEN v_lead_id IS NOT NULL THEN 'converted_to_lead' ELSE status END,
      lead_id = COALESCE(v_lead_id, lead_id),
      converted_booking_id = NULLIF(v_result->>'booking_id', '')::uuid,
      converted_at = COALESCE(converted_at, now()),
      converted_by = auth.uid(),
      updated_at = now()
  WHERE id = v_guest.id;

  RETURN v_result || jsonb_build_object(
    'guest_request_id', v_guest.id,
    'lead_id', v_lead_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.convert_guest_service_request_to_erp_booking(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_guest_service_request_to_erp_booking(uuid)
  TO authenticated;

COMMENT ON COLUMN public.guest_service_requests.booking_details_snapshot IS
  'Structured guest answers and catalogue IDs only. Prices are recalculated from trusted Booking Engine rules when staff converts the request.';
COMMENT ON COLUMN public.guest_service_requests.booking_engine_request_id IS
  'Link to the native Smart Booking request created for staff review; this is not a parallel booking system.';
COMMENT ON FUNCTION public.convert_guest_service_request_to_booking_engine_request(uuid) IS
  'Admin-only, idempotent conversion of a guest enquiry into the native Smart Booking workflow with current service, question, offer and pricing validation.';
COMMENT ON FUNCTION public.convert_guest_service_request_to_erp_booking(uuid) IS
  'Admin-only guest handoff into the existing ERP booking creator after staff records customer confirmation and approves the request.';
