
CREATE OR REPLACE FUNCTION public.accept_booking_engine_quotation(_request_id UUID)
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

  SELECT * INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Booking Engine request not found.';
  END IF;

  IF v_request.customer_user_id IS DISTINCT FROM auth.uid()
     OR v_request.customer_id IS NULL
     OR NOT public.owns_client(v_request.customer_id, auth.uid())
  THEN
    RAISE EXCEPTION 'You are not authorized to act on this quotation.';
  END IF;

  IF v_request.quotation_id IS NULL THEN
    RAISE EXCEPTION 'This Booking Engine request does not have a quotation.';
  END IF;

  SELECT id, quotation_number, price
  INTO v_quotation
  FROM public.quotations
  WHERE id = v_request.quotation_id;

  IF v_quotation.id IS NULL THEN
    RAISE EXCEPTION 'The linked quotation could not be found.';
  END IF;

  IF v_request.status = 'customer_accepted' THEN
    RETURN jsonb_build_object(
      'status', 'already_accepted',
      'request_id', v_request.id,
      'quotation_id', v_quotation.id,
      'quotation_number', v_quotation.quotation_number,
      'quotation_price', v_quotation.price
    );
  END IF;

  IF v_request.status <> 'quote_prepared' THEN
    RAISE EXCEPTION
      'Request must be in quote_prepared before quotation acceptance. Current status: %.',
      v_request.status;
  END IF;

  UPDATE public.booking_engine_requests
  SET status = 'customer_accepted', updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.booking_engine_request_events (
    request_id, event_type, from_status, to_status, message,
    actor_user_id, actor_name, actor_role, metadata
  )
  VALUES (
    v_request.id, 'customer_accepted', v_request.status, 'customer_accepted',
    'Customer accepted the prepared quotation.',
    auth.uid(), NULL, 'customer',
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

CREATE OR REPLACE FUNCTION public.reject_booking_engine_quotation(
  _request_id UUID,
  _reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_quotation RECORD;
  v_reason TEXT := NULLIF(btrim(_reason), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  SELECT * INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Booking Engine request not found.';
  END IF;

  IF v_request.customer_user_id IS DISTINCT FROM auth.uid()
     OR v_request.customer_id IS NULL
     OR NOT public.owns_client(v_request.customer_id, auth.uid())
  THEN
    RAISE EXCEPTION 'You are not authorized to reject this quotation.';
  END IF;

  IF v_request.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'status', 'already_rejected',
      'request_id', v_request.id
    );
  END IF;

  IF v_request.status <> 'quote_prepared' THEN
    RAISE EXCEPTION
      'Only a prepared quotation can be rejected. Current status: %.',
      v_request.status;
  END IF;

  IF v_request.quotation_id IS NULL THEN
    RAISE EXCEPTION 'This Booking Engine request does not have a quotation.';
  END IF;

  SELECT id, quotation_number, price
  INTO v_quotation
  FROM public.quotations
  WHERE id = v_request.quotation_id;

  IF v_quotation.id IS NULL THEN
    RAISE EXCEPTION 'The linked quotation could not be found.';
  END IF;

  UPDATE public.booking_engine_requests
  SET status = 'rejected', updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.booking_engine_request_events (
    request_id, event_type, from_status, to_status, message,
    actor_user_id, actor_name, actor_role, metadata
  )
  VALUES (
    v_request.id, 'customer_rejected_quotation',
    v_request.status, 'rejected',
    COALESCE('Customer declined the prepared quotation.', 'Customer declined the prepared quotation.'),
    auth.uid(), NULL, 'customer',
    jsonb_build_object(
      'quotation_id', v_quotation.id,
      'quotation_number', v_quotation.quotation_number,
      'quotation_price', v_quotation.price,
      'reason', v_reason,
      'rejected_at', now()
    )
  );

  RETURN jsonb_build_object(
    'status', 'rejected',
    'request_id', v_request.id,
    'quotation_id', v_quotation.id,
    'quotation_number', v_quotation.quotation_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_booking_engine_ready_for_booking(_request_id UUID)
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
  v_is_admin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  SELECT * INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Booking Engine request not found.';
  END IF;

  v_is_admin := public.is_admin_or_super(v_user_id);

  IF v_request.status = 'ready_for_booking' THEN
    IF NOT v_is_admin AND (
      v_request.customer_user_id IS DISTINCT FROM v_user_id
      OR v_request.customer_id IS NULL
      OR NOT public.owns_client(v_request.customer_id, v_user_id)
    ) THEN
      RAISE EXCEPTION 'You are not authorized to confirm this booking request.';
    END IF;

    RETURN jsonb_build_object(
      'status', 'already_ready',
      'request_id', v_request.id
    );
  END IF;

  SELECT p.full_name, ur.role::text
  INTO v_actor_name, v_actor_role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF v_request.status = 'approved' THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only admins and super admins can approve a request for booking.';
    END IF;
  ELSIF v_request.status = 'customer_accepted' THEN
    IF v_request.customer_user_id IS DISTINCT FROM v_user_id
       OR v_request.customer_id IS NULL
       OR NOT public.owns_client(v_request.customer_id, v_user_id)
    THEN
      RAISE EXCEPTION 'Only the customer who accepted the quotation can finalize this request.';
    END IF;
  ELSE
    RAISE EXCEPTION
      'Request must be approved or customer_accepted before it can become ready_for_booking. Current status: %.',
      v_request.status;
  END IF;

  UPDATE public.booking_engine_requests
  SET status = 'ready_for_booking', updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.booking_engine_request_events (
    request_id, event_type, from_status, to_status, message,
    actor_user_id, actor_name, actor_role, metadata
  )
  VALUES (
    v_request.id, 'ready_for_booking', v_request.status, 'ready_for_booking',
    'Booking Engine request is ready for conversion to the existing ERP booking workflow.',
    v_user_id, v_actor_name, COALESCE(v_actor_role, 'customer'),
    jsonb_build_object('ready_at', now())
  );

  RETURN jsonb_build_object(
    'status', 'ready_for_booking',
    'request_id', v_request.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_booking_engine_quotation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_booking_engine_quotation(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_booking_engine_quotation(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_booking_engine_quotation(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_booking_engine_ready_for_booking(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_booking_engine_ready_for_booking(UUID) TO authenticated;
