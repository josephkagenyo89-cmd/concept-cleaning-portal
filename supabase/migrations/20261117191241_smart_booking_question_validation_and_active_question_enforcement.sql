-- Smart Booking question validation and active-question enforcement.
ALTER TABLE public.booking_engine_questions
  ADD COLUMN IF NOT EXISTS validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'booking_engine_questions_validation_rules_object'
      AND conrelid = 'public.booking_engine_questions'::regclass
  ) THEN
    ALTER TABLE public.booking_engine_questions
      ADD CONSTRAINT booking_engine_questions_validation_rules_object
      CHECK (jsonb_typeof(validation_rules) = 'object');
  END IF;
END $$;

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

  FOR v_item IN
    SELECT i.*, c.measurement_config, c.photo_mode
    FROM public.booking_engine_request_items i
    JOIN public.booking_engine_service_config c ON c.id = i.service_config_id
    WHERE i.request_id = _request_id
    ORDER BY i.display_order, i.created_at
  LOOP
    IF v_item.photo_mode = 'required' THEN
      RAISE EXCEPTION 'Required photo upload is not supported in this booking form. Contact our team before submitting.';
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
$function$;

CREATE OR REPLACE FUNCTION public.bump_booking_engine_config_versions(_config_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and super admins may update Booking Engine configuration versions';
  END IF;
  IF COALESCE(cardinality(_config_ids), 0) = 0 THEN RETURN 0; END IF;

  UPDATE public.booking_engine_service_config
  SET config_version = COALESCE(config_version, 1) + 1,
      updated_by = auth.uid(),
      updated_at = now()
  WHERE id = ANY(_config_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.bump_booking_engine_config_versions(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_booking_engine_config_versions(uuid[]) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_booking_engine_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_booking_engine_request(uuid) TO authenticated;
