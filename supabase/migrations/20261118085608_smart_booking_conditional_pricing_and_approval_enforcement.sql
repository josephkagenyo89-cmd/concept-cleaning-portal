-- Smart Booking: generic conditional pricing and mandatory setup approval enforcement.

ALTER TABLE public.booking_engine_pricing_rules
  ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_engine_pricing_rules_conditions_shape_check'
      AND conrelid = 'public.booking_engine_pricing_rules'::regclass
  ) THEN
    ALTER TABLE public.booking_engine_pricing_rules
      ADD CONSTRAINT booking_engine_pricing_rules_conditions_shape_check
      CHECK (
        jsonb_typeof(conditions) = 'object'
        AND (
          conditions = '{}'::jsonb
          OR (
            (conditions ? 'answers' OR conditions ? 'measurements')
            AND jsonb_typeof(COALESCE(conditions->'answers', '{}'::jsonb)) = 'object'
            AND jsonb_typeof(COALESCE(conditions->'measurements', '{}'::jsonb)) = 'object'
          )
        )
      );
  END IF;
END
$constraints$;

ALTER TABLE public.booking_engine_request_photos
  ADD CONSTRAINT booking_engine_request_photos_max_1mb_check
  CHECK (file_size_bytes <= 1048576);

UPDATE storage.buckets SET file_size_limit = 1048576
WHERE id = 'booking-engine-photos';

CREATE OR REPLACE FUNCTION public.calculate_booking_engine_item_price_base(p_request_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_has_conditional_rules BOOLEAN := false;
  v_currency TEXT := 'KES';
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
    sc.name AS category_name,
    s.base_price,
    s.pricing_model,
    s.pricing_unit,
    s.price_per_sqm,
    s.is_active
  INTO v_service
  FROM public.services s
  LEFT JOIN public.service_categories sc ON sc.id = s.category_id
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


    SELECT EXISTS (SELECT 1 FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id AND pr.active IS TRUE
        AND pr.conditions <> '{}'::jsonb) INTO v_has_conditional_rules;

    IF v_has_conditional_rules THEN
      v_quantity := COALESCE(v_item.quantity, 1);
      SELECT COUNT(*) INTO v_rule_count
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id AND pr.active IS TRUE
        AND pr.conditions <> '{}'::jsonb
        AND (NOT (pr.conditions ? 'answers') OR v_item.answers @> pr.conditions->'answers')
        AND (NOT (pr.conditions ? 'measurements') OR v_item.measurements @> pr.conditions->'measurements')
        AND (pr.minimum_quantity IS NULL OR v_quantity >= pr.minimum_quantity)
        AND (pr.maximum_quantity IS NULL OR v_quantity <= pr.maximum_quantity);

      IF v_rule_count = 0 THEN
        RAISE EXCEPTION 'No approved pricing option matches the selected service answers for "%".', v_service.name;
      ELSIF v_rule_count > 1 THEN
        RAISE EXCEPTION 'More than one pricing rule matches the selected service answers for "%". Ask an administrator to correct the pricing setup.', v_service.name;
      END IF;

      SELECT pr.* INTO v_rule
      FROM public.booking_engine_pricing_rules pr
      WHERE pr.service_config_id = v_config.id AND pr.active IS TRUE
        AND pr.conditions <> '{}'::jsonb
        AND (NOT (pr.conditions ? 'answers') OR v_item.answers @> pr.conditions->'answers')
        AND (NOT (pr.conditions ? 'measurements') OR v_item.measurements @> pr.conditions->'measurements')
        AND (pr.minimum_quantity IS NULL OR v_quantity >= pr.minimum_quantity)
        AND (pr.maximum_quantity IS NULL OR v_quantity <= pr.maximum_quantity)
      LIMIT 1;

      v_pricing_type := v_rule.pricing_type;
      v_rate := v_rule.rate;
      v_currency := COALESCE(v_rule.currency, 'KES');
      v_unit_key := v_rule.unit_key;
      v_pricing_source := 'booking_engine_rule';

      IF v_pricing_type = 'quotation' THEN
        v_snapshot := jsonb_build_object(
          'status', 'quotation_required', 'pricing_type', 'quotation',
          'pricing_source', 'booking_engine_rule', 'service_id', v_service.id,
          'service_name', v_service.name, 'configuration_version', COALESCE(v_config.config_version, 1),
          'rule_id', v_rule.id, 'rule_conditions', v_rule.conditions,
          'selected_answers', v_item.answers, 'currency', v_rule.currency
        );
        UPDATE public.booking_engine_request_items
        SET pricing_snapshot = v_snapshot, updated_at = now()
        WHERE id = p_request_item_id;
        RETURN v_snapshot;
      ELSIF v_pricing_type = 'per_measurement' THEN
        IF v_unit_key IS NULL OR v_unit_key = '' THEN
          RAISE EXCEPTION 'Measurement unit is missing for service "%".', v_service.name;
        END IF;
        v_measurement := NULLIF(v_item.measurements ->> v_unit_key, '')::NUMERIC;
        IF v_measurement IS NULL OR v_measurement <= 0 THEN
          RAISE EXCEPTION 'A valid % measurement is required for service "%".', v_unit_key, v_service.name;
        END IF;
        v_subtotal := v_measurement * v_rate;
      ELSIF v_pricing_type = 'fixed' THEN
        v_subtotal := v_rate;
      ELSIF v_pricing_type IN ('per_unit', 'tiered') THEN
        IF v_quantity IS NULL OR v_quantity <= 0 THEN
          RAISE EXCEPTION 'A valid quantity is required for service "%".', v_service.name;
        END IF;
        v_subtotal := v_quantity * v_rate;
      ELSE
        RAISE EXCEPTION 'Unsupported conditional Booking Engine pricing type "%" for service "%".', v_pricing_type, v_service.name;
      END IF;

    ELSE

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
        v_currency := COALESCE(v_rule.currency, 'KES');
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
          IF v_rule.minimum_quantity IS NOT NULL AND v_quantity < v_rule.minimum_quantity THEN
            RAISE EXCEPTION 'Quantity is below the configured minimum for service "%".', v_service.name;
          END IF;
          IF v_rule.maximum_quantity IS NOT NULL AND v_quantity > v_rule.maximum_quantity THEN
            RAISE EXCEPTION 'Quantity exceeds the configured maximum for service "%".', v_service.name;
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
    'service_category', v_service.category_name,
    'base_price', v_service.base_price,
    'quantity', v_quantity,
    'measurement_unit', v_unit_key,
    'measurement_value', v_measurement,
    'rate', v_rate,
    'rule_id', v_rule.id,
    'rule_conditions', COALESCE(v_rule.conditions, '{}'::jsonb),
    'selected_answers', v_item.answers,
    'selected_measurements', v_item.measurements,
    'subtotal', v_subtotal,
    'discount_amount', 0,
    'total', v_total,
    'currency', COALESCE(v_currency, 'KES'),
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
$function$
;

CREATE OR REPLACE FUNCTION public.submit_booking_engine_request(_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request public.booking_engine_requests%ROWTYPE;
  v_item RECORD;
  v_question RECORD;
  v_condition RECORD;
  v_item_count integer;
  v_invalid_item_count integer;
  v_approval_count integer;
  v_user_id uuid := auth.uid();
  v_answer jsonb;
  v_dep_answer jsonb;
  v_actual text;
  v_expected text;
  v_match boolean;
  v_visible boolean;
  v_required boolean;
  v_quantity_min numeric;
  v_quantity_max numeric;
  v_rule_min numeric;
  v_rule_max numeric;
  v_min_length integer;
  v_max_length integer;
  v_answer_text text;
  v_option jsonb;
  v_valid_option boolean;
  v_selected jsonb;
  v_photo_count integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_request FROM public.booking_engine_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking Engine request not found'; END IF;
  IF v_request.customer_user_id IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'You do not own this Booking Engine request'; END IF;
  IF NOT public.owns_client(v_request.customer_id, v_user_id) THEN RAISE EXCEPTION 'Customer ownership could not be verified'; END IF;
  IF v_request.status <> 'draft' THEN RAISE EXCEPTION 'Only draft requests can be submitted'; END IF;
  IF v_request.requested_date IS NULL OR v_request.requested_date < (now() AT TIME ZONE 'Africa/Nairobi')::date THEN RAISE EXCEPTION 'A valid future requested service date is required'; END IF;
  IF v_request.requested_time IS NULL THEN RAISE EXCEPTION 'Requested service time is required'; END IF;
  IF NULLIF(btrim(v_request.service_location), '') IS NULL THEN RAISE EXCEPTION 'Service location is required'; END IF;
  IF NOT v_request.customer_acknowledged_scope THEN RAISE EXCEPTION 'Customer must acknowledge the service scope'; END IF;

  SELECT count(*) INTO v_item_count FROM public.booking_engine_request_items WHERE request_id = _request_id;
  IF v_item_count = 0 THEN RAISE EXCEPTION 'At least one service is required'; END IF;

  SELECT count(*) INTO v_invalid_item_count
  FROM public.booking_engine_request_items i
  LEFT JOIN public.booking_engine_service_config c ON c.id = i.service_config_id
  WHERE i.request_id = _request_id
    AND (i.service_config_id IS NULL OR c.id IS NULL OR c.service_id IS DISTINCT FROM i.service_id OR c.enabled IS NOT TRUE);
  IF v_invalid_item_count > 0 THEN RAISE EXCEPTION 'One or more requested services are not currently enabled for Booking Engine'; END IF;

  -- A submitted service must have all six current administrator approvals.
  FOR v_item IN
    SELECT DISTINCT i.service_config_id
    FROM public.booking_engine_request_items i
    WHERE i.request_id = _request_id
  LOOP
    SELECT COUNT(*) INTO v_approval_count
    FROM public.booking_engine_setup_step_approvals a
    WHERE a.service_config_id = v_item.service_config_id
      AND a.step_key = ANY(ARRAY['instructions','questions','pricing','scope','offers','final_review'])
      AND a.snapshot_hash = public.booking_engine_setup_step_fingerprint(v_item.service_config_id, a.step_key);

    IF v_approval_count <> 6 THEN
      RAISE EXCEPTION 'This service has not completed its administrator setup approvals. Please contact our team.';
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT i.*, c.measurement_config, c.photo_mode, c.photo_min, c.photo_max
    FROM public.booking_engine_request_items i
    JOIN public.booking_engine_service_config c ON c.id = i.service_config_id
    WHERE i.request_id = _request_id
    ORDER BY i.display_order, i.created_at
  LOOP
    IF v_item.photo_mode = 'required' THEN
      SELECT count(*) INTO v_photo_count
      FROM public.booking_engine_request_photos p
      WHERE p.request_id = v_item.request_id
        AND p.request_item_id = v_item.id;
      IF v_photo_count < GREATEST(COALESCE(v_item.photo_min, 1), 1) THEN
        RAISE EXCEPTION 'Upload at least % photo(s) for this service.', GREATEST(COALESCE(v_item.photo_min, 1), 1);
      END IF;
    END IF;
    IF v_item.photo_max > 0 THEN
      SELECT count(*) INTO v_photo_count
      FROM public.booking_engine_request_photos p
      WHERE p.request_id = v_item.request_id
        AND p.request_item_id = v_item.id;
      IF v_photo_count > v_item.photo_max THEN
        RAISE EXCEPTION 'Remove photos until no more than % remain for this service.', v_item.photo_max;
      END IF;
    END IF;

    IF COALESCE((v_item.measurement_config #>> '{quantity,enabled}')::boolean, false) THEN
      IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN RAISE EXCEPTION 'A valid quantity is required for service %', v_item.service_id; END IF;
      v_quantity_min := NULLIF(v_item.measurement_config #>> '{quantity,min}', '')::numeric;
      v_quantity_max := NULLIF(v_item.measurement_config #>> '{quantity,max}', '')::numeric;
      IF v_quantity_min IS NOT NULL AND v_item.quantity < v_quantity_min THEN RAISE EXCEPTION 'Quantity is below the configured minimum for service %', v_item.service_id; END IF;
      IF v_quantity_max IS NOT NULL AND v_item.quantity > v_quantity_max THEN RAISE EXCEPTION 'Quantity exceeds the configured maximum for service %', v_item.service_id; END IF;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.booking_engine_service_scope sc
      WHERE sc.service_config_id = v_item.service_config_id
        AND sc.scope_type = 'included' AND sc.active IS TRUE
    ) THEN
      RAISE EXCEPTION 'Included service scope is not configured for service %', v_item.service_id;
    END IF;

    IF COALESCE(v_item.pricing_snapshot->>'status', '') NOT IN ('priced', 'quotation_required') THEN
      RAISE EXCEPTION 'Server pricing review is incomplete for service %', v_item.service_id;
    END IF;

    FOR v_question IN
      SELECT q.* FROM public.booking_engine_questions q
      WHERE q.service_config_id = v_item.service_config_id
        AND q.active IS TRUE
      ORDER BY q.display_order
    LOOP
      v_answer := v_item.answers -> v_question.question_key;
      v_visible := true;
      v_required := COALESCE(v_question.required, false);

      FOR v_condition IN
        SELECT c.*, dq.question_key AS depends_on_question_key
        FROM public.booking_engine_question_conditions c
        JOIN public.booking_engine_questions dq ON dq.id = c.depends_on_question_id AND dq.active IS TRUE
        WHERE c.question_id = v_question.id
        ORDER BY c.created_at, c.id
      LOOP
        v_dep_answer := v_item.answers -> v_condition.depends_on_question_key;
        v_actual := CASE
          WHEN v_dep_answer IS NULL OR v_dep_answer = 'null'::jsonb THEN ''
          WHEN jsonb_typeof(v_dep_answer) = 'string' THEN v_dep_answer #>> '{}'
          ELSE v_dep_answer::text
        END;
        v_expected := COALESCE(v_condition.expected_value #>> '{}', trim(both '"' from v_condition.expected_value::text));
        v_match := CASE v_condition.operator
          WHEN 'equals' THEN v_actual = v_expected
          WHEN 'not_equals' THEN v_actual <> v_expected
          WHEN 'greater_than' THEN CASE WHEN v_actual ~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' AND v_expected ~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' THEN v_actual::numeric > v_expected::numeric ELSE false END
          WHEN 'less_than' THEN CASE WHEN v_actual ~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' AND v_expected ~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' THEN v_actual::numeric < v_expected::numeric ELSE false END
          WHEN 'contains' THEN CASE WHEN jsonb_typeof(v_dep_answer) = 'array' THEN v_dep_answer ? v_expected ELSE position(v_expected in v_actual) > 0 END
          ELSE false
        END;
        IF v_condition.action = 'show' THEN v_visible := v_match; END IF;
        IF v_condition.action = 'hide' AND v_match THEN v_visible := false; END IF;
        IF v_condition.action = 'required' THEN v_required := v_match; END IF;
        IF v_condition.action = 'optional' AND v_match THEN v_required := false; END IF;
      END LOOP;

      IF v_visible AND v_required AND (
        v_answer IS NULL OR v_answer = 'null'::jsonb OR v_answer = '""'::jsonb OR v_answer = '[]'::jsonb
        OR (jsonb_typeof(v_answer) = 'string' AND btrim(v_answer #>> '{}') = '')
      ) THEN
        RAISE EXCEPTION 'Please answer required question: %', v_question.label;
      END IF;

      IF v_visible AND v_answer IS NOT NULL AND v_answer <> 'null'::jsonb
         AND NOT (jsonb_typeof(v_answer) = 'string' AND btrim(v_answer #>> '{}') = '')
         AND NOT (jsonb_typeof(v_answer) = 'array' AND jsonb_array_length(v_answer) = 0) THEN
        IF jsonb_typeof(v_question.validation_rules) <> 'object' THEN
          RAISE EXCEPTION 'Validation settings for question "%" are invalid. Please contact our team.', v_question.label;
        END IF;

        v_rule_min := NULLIF(v_question.validation_rules->>'min', '')::numeric;
        v_rule_max := NULLIF(v_question.validation_rules->>'max', '')::numeric;
        v_min_length := NULLIF(v_question.validation_rules->>'min_length', '')::integer;
        v_max_length := NULLIF(v_question.validation_rules->>'max_length', '')::integer;

        IF v_question.input_type IN ('number', 'measurement') THEN
          v_answer_text := CASE WHEN jsonb_typeof(v_answer) = 'string' THEN v_answer #>> '{}' ELSE v_answer::text END;
          IF v_answer_text !~ '^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' THEN
            RAISE EXCEPTION 'Enter a valid number for "%".', v_question.label;
          END IF;
          IF v_rule_min IS NOT NULL AND v_answer_text::numeric < v_rule_min THEN RAISE EXCEPTION '"%" must be at least %.', v_question.label, v_rule_min; END IF;
          IF v_rule_max IS NOT NULL AND v_answer_text::numeric > v_rule_max THEN RAISE EXCEPTION '"%" must be no more than %.', v_question.label, v_rule_max; END IF;
        ELSIF v_question.input_type = 'boolean' THEN
          IF jsonb_typeof(v_answer) <> 'boolean' THEN RAISE EXCEPTION 'Choose yes or no for "%".', v_question.label; END IF;
        ELSIF v_question.input_type = 'select' THEN
          IF jsonb_typeof(v_answer) <> 'string' THEN RAISE EXCEPTION 'Choose one of the available options for "%".', v_question.label; END IF;
          v_valid_option := false;
          FOR v_option IN SELECT value FROM jsonb_array_elements(COALESCE(v_question.options, '[]'::jsonb))
          LOOP
            IF (v_option->>'value' = v_answer #>> '{}')
              OR (v_option->>'id' = v_answer #>> '{}')
              OR (v_option->>'label' = v_answer #>> '{}')
              OR (jsonb_typeof(v_option) = 'string' AND v_option #>> '{}' = v_answer #>> '{}') THEN
              v_valid_option := true;
            END IF;
          END LOOP;
          IF NOT v_valid_option THEN RAISE EXCEPTION 'Choose a valid option for "%".', v_question.label; END IF;
        ELSIF v_question.input_type = 'multi_select' THEN
          IF jsonb_typeof(v_answer) <> 'array' THEN RAISE EXCEPTION 'Choose one or more valid options for "%".', v_question.label; END IF;
          FOR v_selected IN SELECT value FROM jsonb_array_elements(v_answer)
          LOOP
            v_valid_option := false;
            FOR v_option IN SELECT value FROM jsonb_array_elements(COALESCE(v_question.options, '[]'::jsonb))
            LOOP
              IF (v_option->>'value' = v_selected #>> '{}')
                OR (v_option->>'id' = v_selected #>> '{}')
                OR (v_option->>'label' = v_selected #>> '{}')
                OR (jsonb_typeof(v_option) = 'string' AND v_option #>> '{}' = v_selected #>> '{}') THEN
                v_valid_option := true;
              END IF;
            END LOOP;
            IF NOT v_valid_option THEN RAISE EXCEPTION 'One or more selected options are invalid for "%".', v_question.label; END IF;
          END LOOP;
        ELSE
          IF jsonb_typeof(v_answer) <> 'string' THEN RAISE EXCEPTION 'Enter text for "%".', v_question.label; END IF;
          v_answer_text := v_answer #>> '{}';
          IF v_min_length IS NOT NULL AND char_length(v_answer_text) < v_min_length THEN RAISE EXCEPTION '"%" must contain at least % characters.', v_question.label, v_min_length; END IF;
          IF v_max_length IS NOT NULL AND char_length(v_answer_text) > v_max_length THEN RAISE EXCEPTION '"%" must contain no more than % characters.', v_question.label, v_max_length; END IF;
          IF NULLIF(v_question.validation_rules->>'pattern', '') IS NOT NULL AND v_answer_text !~ (v_question.validation_rules->>'pattern') THEN
            RAISE EXCEPTION '"%" does not match the required format.', v_question.label;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.booking_engine_requests
  SET status = 'submitted', submitted_at = COALESCE(submitted_at, now()), updated_at = now()
  WHERE id = _request_id;
  INSERT INTO public.booking_engine_request_events(request_id,event_type,from_status,to_status,message,actor_user_id,actor_role)
  VALUES(_request_id,'submitted','draft','submitted','Customer submitted Booking Engine request',v_user_id,'customer');
  RETURN _request_id;
END;
$function$
;

-- Consolidate legacy seat-count sofa catalogue entries into one configurable service.
-- Old service rows remain in place for their historical booking references.
DO $sofa_setup$
DECLARE
  v_config_id UUID;
  v_service_id UUID;
  v_next_version INTEGER;
BEGIN
  SELECT s.id, c.id INTO v_service_id, v_config_id
  FROM public.services s
  JOIN public.booking_engine_service_config c ON c.service_id = s.id
  WHERE s.name = 'Sofa Cleaning – 4 Seater';

  IF v_config_id IS NULL THEN
    RAISE EXCEPTION 'The existing Sofa Cleaning – 4 Seater configuration was not found; no sofa configuration was changed.';
  END IF;

  UPDATE public.services
  SET name = 'Sofa Cleaning', base_price = 700,
      pricing_model = 'per_unit', pricing_unit = 'seat'
  WHERE id = v_service_id;

  INSERT INTO public.booking_engine_service_aliases
    (alias_service_id, primary_service_id, match_confidence, notes)
  SELECT s.id, v_service_id, 1.0,
         'Legacy sofa seat-count service consolidated into the configurable Sofa Cleaning service; historical records remain linked to this original service.'
  FROM public.services s
  WHERE s.service_code IN ('4SS','SC2S','SC3S','SC5S','SCLS','SC4')
    AND s.id <> v_service_id
  ON CONFLICT (alias_service_id, primary_service_id) DO UPDATE
    SET match_confidence = EXCLUDED.match_confidence,
        notes = EXCLUDED.notes,
        updated_at = now();

  UPDATE public.services
  SET is_active = false
  WHERE service_code IN ('4SS','SC2S','SC3S','SC5S','SCLS','SC4')
    AND id <> v_service_id
    AND is_active IS TRUE;

  UPDATE public.booking_engine_service_config
  SET enabled = false,
      config_version = config_version + 1,
      customer_instructions = 'Choose the number of seats and the sofa material. The estimate is calculated from the approved rate and your selections.',
      photo_mode = 'optional', photo_min = 0, photo_max = 5,
      measurement_config = jsonb_build_object(
        'quantity', jsonb_build_object(
          'enabled', true, 'label', 'Number of seats', 'unit', 'seat',
          'min', 1, 'max', 10, 'step', 1
        )
      ),
      updated_at = now()
  WHERE id = v_config_id;

  UPDATE public.booking_engine_pricing_rules
  SET active = false, updated_at = now()
  WHERE service_config_id = v_config_id AND active IS TRUE;

  INSERT INTO public.booking_engine_questions
    (service_config_id, question_key, label, description, input_type, required, display_order, options, active, validation_rules)
  VALUES (
    v_config_id, 'material', 'Sofa material',
    'Choose the material of the sofa you want cleaned.',
    'select', true, 0,
    '[{"value":"fabric","label":"Fabric"},{"value":"leather","label":"Leather"}]'::jsonb,
    true, '{}'::jsonb
  )
  ON CONFLICT (service_config_id, question_key) DO UPDATE
  SET label = EXCLUDED.label, description = EXCLUDED.description,
      input_type = EXCLUDED.input_type, required = EXCLUDED.required,
      display_order = EXCLUDED.display_order, options = EXCLUDED.options,
      active = true, validation_rules = EXCLUDED.validation_rules, updated_at = now();

  UPDATE public.booking_engine_service_scope
  SET title = 'Professional sofa cleaning',
      description = 'Professional cleaning of the selected number of sofa seats.',
      updated_at = now()
  WHERE service_config_id = v_config_id
    AND scope_type = 'included' AND active IS TRUE;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
  FROM public.booking_engine_pricing_rules
  WHERE service_config_id = v_config_id;

  INSERT INTO public.booking_engine_pricing_rules
    (service_config_id, pricing_type, unit_key, rate, minimum_quantity, maximum_quantity, currency, version, active, conditions)
  VALUES
    (v_config_id, 'per_unit', 'seat', 700, 1, 10, 'KES', v_next_version, true, '{"answers":{"material":"fabric"}}'::jsonb),
    (v_config_id, 'per_unit', 'seat', 700, 1, 10, 'KES', v_next_version + 1, true, '{"answers":{"material":"leather"}}'::jsonb);
END
$sofa_setup$;
