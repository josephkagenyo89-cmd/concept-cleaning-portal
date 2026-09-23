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

  SELECT COUNT(*)
  INTO v_client_count
  FROM public.clients
  WHERE user_id = v_user_id;

  IF v_client_count = 0 THEN
    RAISE EXCEPTION 'Customer CRM record not found';
  END IF;

  IF v_client_count > 1 THEN
    RAISE EXCEPTION 'Multiple customer CRM records are linked to this account';
  END IF;

  SELECT id
  INTO v_client_id
  FROM public.clients
  WHERE user_id = v_user_id;

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
