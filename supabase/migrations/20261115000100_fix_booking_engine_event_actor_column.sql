-- Repair Booking Engine event logging column references.
--
-- booking_engine_request_events stores the actor display name in actor_name.
-- Four workflow functions referenced a non-existent column, causing
-- conversion, quotation and status-transition event inserts to fail.
-- Replace the affected functions without changing their signatures,
-- workflow rules, authorization checks, or existing booking/quotation tables.
--
-- This migration intentionally does not enable service configurations or
-- seed service-specific pricing/questions. Those require explicit service
-- mapping and configuration, and must not be guessed.

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
$$;

REVOKE ALL
ON FUNCTION public.convert_booking_engine_request(UUID)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.convert_booking_engine_request(UUID)
TO authenticated;

-- ------------------------------------------------------------------

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
    actor_name,
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

-- ------------------------------------------------------------------

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
    actor_name,
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

-- ------------------------------------------------------------------

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
    actor_name,
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
