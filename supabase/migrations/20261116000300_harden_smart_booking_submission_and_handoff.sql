-- Smart Booking Phase 1/2 hardening: validate customer submissions, make staff status+event atomic, preserve appointment time, and use service_categories as the pricing category authority.

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_time time without time zone;

CREATE OR REPLACE FUNCTION public.booking_engine_is_valid_transition(_from_status public.booking_engine_request_status, _to_status public.booking_engine_request_status)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $function$
SELECT CASE _from_status
 WHEN 'draft' THEN _to_status IN ('submitted','cancelled')
 WHEN 'submitted' THEN _to_status IN ('under_review','awaiting_customer','rejected','cancelled')
 WHEN 'under_review' THEN _to_status IN ('awaiting_customer','approved','quote_required','rejected','cancelled')
 WHEN 'awaiting_customer' THEN _to_status IN ('under_review','customer_accepted','cancelled')
 WHEN 'approved' THEN _to_status IN ('quote_required','ready_for_booking','cancelled')
 WHEN 'quote_required' THEN _to_status IN ('quote_prepared','rejected','cancelled')
 WHEN 'quote_prepared' THEN _to_status IN ('customer_accepted','rejected','cancelled')
 WHEN 'customer_accepted' THEN _to_status IN ('ready_for_booking','cancelled')
 WHEN 'ready_for_booking' THEN _to_status IN ('converted','cancelled')
 ELSE false END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_booking_engine_request(_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
 v_request public.booking_engine_requests%ROWTYPE;
 v_item RECORD; v_question RECORD; v_condition RECORD;
 v_item_count integer; v_invalid_item_count integer; v_user_id uuid:=auth.uid();
 v_answer jsonb; v_dep_answer jsonb; v_actual text; v_expected text;
 v_match boolean; v_visible boolean; v_required boolean;
 v_quantity_min numeric; v_quantity_max numeric;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 SELECT * INTO v_request FROM public.booking_engine_requests WHERE id=_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking Engine request not found'; END IF;
 IF v_request.customer_user_id IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'You do not own this Booking Engine request'; END IF;
 IF NOT public.owns_client(v_request.customer_id,v_user_id) THEN RAISE EXCEPTION 'Customer ownership could not be verified'; END IF;
 IF v_request.status<>'draft' THEN RAISE EXCEPTION 'Only draft requests can be submitted'; END IF;
 IF v_request.requested_date IS NULL OR v_request.requested_date<(now() AT TIME ZONE 'Africa/Nairobi')::date THEN RAISE EXCEPTION 'A valid future requested service date is required'; END IF;
 IF v_request.requested_time IS NULL THEN RAISE EXCEPTION 'Requested service time is required'; END IF;
 IF NULLIF(btrim(v_request.service_location),'') IS NULL THEN RAISE EXCEPTION 'Service location is required'; END IF;
 IF NOT v_request.customer_acknowledged_scope THEN RAISE EXCEPTION 'Customer must acknowledge the service scope'; END IF;
 SELECT count(*) INTO v_item_count FROM public.booking_engine_request_items WHERE request_id=_request_id;
 IF v_item_count=0 THEN RAISE EXCEPTION 'At least one service is required'; END IF;
 SELECT count(*) INTO v_invalid_item_count
 FROM public.booking_engine_request_items i LEFT JOIN public.booking_engine_service_config c ON c.id=i.service_config_id
 WHERE i.request_id=_request_id AND (i.service_config_id IS NULL OR c.id IS NULL OR c.service_id IS DISTINCT FROM i.service_id OR c.enabled IS NOT TRUE);
 IF v_invalid_item_count>0 THEN RAISE EXCEPTION 'One or more requested services are not currently enabled for Booking Engine'; END IF;
 FOR v_item IN
  SELECT i.*,c.measurement_config,c.photo_mode
  FROM public.booking_engine_request_items i JOIN public.booking_engine_service_config c ON c.id=i.service_config_id
  WHERE i.request_id=_request_id ORDER BY i.display_order,i.created_at
 LOOP
  IF v_item.photo_mode='required' THEN RAISE EXCEPTION 'Required photo upload is not supported in this booking form. Contact our team before submitting.'; END IF;
  IF COALESCE((v_item.measurement_config #>> '{quantity,enabled}')::boolean,false) THEN
   IF v_item.quantity IS NULL OR v_item.quantity<=0 THEN RAISE EXCEPTION 'A valid quantity is required for service %',v_item.service_id; END IF;
   v_quantity_min:=NULLIF(v_item.measurement_config #>> '{quantity,min}','')::numeric;
   v_quantity_max:=NULLIF(v_item.measurement_config #>> '{quantity,max}','')::numeric;
   IF v_quantity_min IS NOT NULL AND v_item.quantity<v_quantity_min THEN RAISE EXCEPTION 'Quantity is below the configured minimum for service %',v_item.service_id; END IF;
   IF v_quantity_max IS NOT NULL AND v_item.quantity>v_quantity_max THEN RAISE EXCEPTION 'Quantity exceeds the configured maximum for service %',v_item.service_id; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.booking_engine_service_scope sc WHERE sc.service_config_id=v_item.service_config_id AND sc.scope_type='included' AND sc.active IS TRUE) THEN
   RAISE EXCEPTION 'Included service scope is not configured for service %',v_item.service_id;
  END IF;
  IF COALESCE(v_item.pricing_snapshot->>'status','') NOT IN ('priced','quotation_required') THEN RAISE EXCEPTION 'Server pricing review is incomplete for service %',v_item.service_id; END IF;
  FOR v_question IN SELECT q.* FROM public.booking_engine_questions q WHERE q.service_config_id=v_item.service_config_id ORDER BY q.display_order
  LOOP
   v_answer:=v_item.answers->v_question.question_key; v_visible:=true; v_required:=COALESCE(v_question.required,false);
   FOR v_condition IN
    SELECT c.*,dq.question_key AS depends_on_question_key
    FROM public.booking_engine_question_conditions c JOIN public.booking_engine_questions dq ON dq.id=c.depends_on_question_id
    WHERE c.question_id=v_question.id ORDER BY c.created_at,c.id
   LOOP
    v_dep_answer:=v_item.answers->v_condition.depends_on_question_key;
    v_actual:=CASE WHEN v_dep_answer IS NULL OR v_dep_answer='null'::jsonb THEN '' WHEN jsonb_typeof(v_dep_answer)='string' THEN v_dep_answer#>>'{}' ELSE v_dep_answer::text END;
    v_expected:=COALESCE(v_condition.expected_value#>>'{}',trim(both '"' from v_condition.expected_value::text));
    v_match:=CASE v_condition.operator
     WHEN 'equals' THEN v_actual=v_expected
     WHEN 'not_equals' THEN v_actual<>v_expected
     WHEN 'greater_than' THEN CASE WHEN v_actual~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' AND v_expected~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' THEN v_actual::numeric>v_expected::numeric ELSE false END
     WHEN 'less_than' THEN CASE WHEN v_actual~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' AND v_expected~'^[+-]?([0-9]+(\.[0-9]*)?|\.[0-9]+)$' THEN v_actual::numeric<v_expected::numeric ELSE false END
     WHEN 'contains' THEN CASE WHEN jsonb_typeof(v_dep_answer)='array' THEN v_dep_answer?v_expected ELSE position(v_expected in v_actual)>0 END
     ELSE false END;
    IF v_condition.action='show' THEN v_visible:=v_match; END IF;
    IF v_condition.action='hide' AND v_match THEN v_visible:=false; END IF;
    IF v_condition.action='required' THEN v_required:=v_match; END IF;
    IF v_condition.action='optional' AND v_match THEN v_required:=false; END IF;
   END LOOP;
   IF v_visible AND v_required AND (v_answer IS NULL OR v_answer='null'::jsonb OR v_answer='""'::jsonb OR v_answer='[]'::jsonb OR (jsonb_typeof(v_answer)='string' AND btrim(v_answer#>>'{}')='')) THEN
    RAISE EXCEPTION 'Please answer required question: %',v_question.label;
   END IF;
  END LOOP;
 END LOOP;
 UPDATE public.booking_engine_requests SET status='submitted',submitted_at=COALESCE(submitted_at,now()),updated_at=now() WHERE id=_request_id;
 INSERT INTO public.booking_engine_request_events(request_id,event_type,from_status,to_status,message,actor_user_id,actor_role)
 VALUES(_request_id,'submitted','draft','submitted','Customer submitted Booking Engine request',v_user_id,'customer');
 RETURN _request_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_booking_engine_request_admin(_request_id uuid,_to_status public.booking_engine_request_status,_message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_request public.booking_engine_requests%ROWTYPE; v_actor_name text; v_actor_role text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'Only admins and super admins may update Booking Engine workflow status'; END IF;
 IF _to_status NOT IN ('under_review','approved','quote_required','rejected') THEN RAISE EXCEPTION 'Unsupported staff workflow status'; END IF;
 SELECT * INTO v_request FROM public.booking_engine_requests WHERE id=_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking Engine request not found'; END IF;
 IF NOT public.booking_engine_is_valid_transition(v_request.status,_to_status) THEN RAISE EXCEPTION 'Invalid Booking Engine status transition: % -> %',v_request.status,_to_status; END IF;
 SELECT p.full_name,ur.role::text INTO v_actor_name,v_actor_role
 FROM public.profiles p JOIN public.user_roles ur ON ur.user_id=p.user_id
 WHERE p.user_id=auth.uid() AND ur.role IN ('admin','super_admin')
 ORDER BY CASE WHEN ur.role::text='super_admin' THEN 0 ELSE 1 END LIMIT 1;
 IF v_actor_role IS NULL THEN RAISE EXCEPTION 'Admin profile or role could not be determined'; END IF;
 UPDATE public.booking_engine_requests SET status=_to_status,updated_at=now() WHERE id=_request_id;
 INSERT INTO public.booking_engine_request_events(request_id,event_type,from_status,to_status,message,actor_user_id,actor_name,actor_role,metadata)
 VALUES(_request_id,_to_status::text,v_request.status,_to_status,COALESCE(NULLIF(btrim(_message),''),'Staff updated Booking Engine request status.'),auth.uid(),COALESCE(v_actor_name,'Admin'),v_actor_role,jsonb_build_object('source','admin_booking_engine'));
 RETURN jsonb_build_object('request_id',_request_id,'from_status',v_request.status,'to_status',_to_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_booking_engine_item_price(p_request_item_id uuid)
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
$function$

;

CREATE OR REPLACE FUNCTION public.convert_booking_engine_request(_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  service_time,
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
  v_request.requested_time,
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
    actor_name,
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
$function$;


REVOKE ALL ON FUNCTION public.transition_booking_engine_request_admin(uuid, public.booking_engine_request_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_booking_engine_request_admin(uuid, public.booking_engine_request_status, text) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_booking_engine_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_booking_engine_request(uuid) TO authenticated;