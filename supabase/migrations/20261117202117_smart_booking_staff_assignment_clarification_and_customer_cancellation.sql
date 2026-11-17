-- Complete Smart Booking staff assignment, clarification and customer cancellation.
-- This migration is applied to the existing live project; no customer records are seeded.

ALTER TABLE public.booking_engine_requests
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS booking_engine_requests_assigned_to_idx
  ON public.booking_engine_requests(assigned_to, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.transition_booking_engine_request_admin(
  _request_id uuid,
  _to_status public.booking_engine_request_status,
  _message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request public.booking_engine_requests%ROWTYPE;
  v_actor_name text;
  v_actor_role text;
  v_message text := NULLIF(btrim(_message), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and super admins may update Booking Engine workflow status';
  END IF;

  IF _to_status NOT IN ('under_review','awaiting_customer','approved','quote_required','rejected','cancelled') THEN
    RAISE EXCEPTION 'Unsupported staff workflow status';
  END IF;

  IF v_message IS NOT NULL AND length(v_message) > 3000 THEN
    RAISE EXCEPTION 'Workflow message must be 3000 characters or fewer';
  END IF;

  SELECT * INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request not found';
  END IF;

  IF NOT public.booking_engine_is_valid_transition(v_request.status, _to_status) THEN
    RAISE EXCEPTION 'Invalid Booking Engine status transition: % -> %', v_request.status, _to_status;
  END IF;

  SELECT p.full_name, ur.role::text
    INTO v_actor_name, v_actor_role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = auth.uid()
    AND ur.role IN ('admin','super_admin')
  ORDER BY CASE WHEN ur.role::text = 'super_admin' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'Admin profile or role could not be determined';
  END IF;

  UPDATE public.booking_engine_requests
  SET status = _to_status, updated_at = now()
  WHERE id = _request_id;

  INSERT INTO public.booking_engine_request_events(
    request_id,event_type,from_status,to_status,message,actor_user_id,actor_name,actor_role,metadata
  )
  VALUES (
    _request_id,
    CASE WHEN _to_status = 'awaiting_customer' THEN 'clarification_requested' ELSE _to_status::text END,
    v_request.status,
    _to_status,
    COALESCE(v_message, CASE WHEN _to_status = 'awaiting_customer'
      THEN 'Additional information is required from the customer.'
      ELSE 'Staff updated Booking Engine request status.' END),
    auth.uid(),
    COALESCE(v_actor_name,'Admin'),
    v_actor_role,
    jsonb_build_object('source','admin_booking_engine')
  );

  RETURN jsonb_build_object('request_id',_request_id,'from_status',v_request.status,'to_status',_to_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.assign_booking_engine_request_admin(
  _request_id uuid,
  _assigned_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request public.booking_engine_requests%ROWTYPE;
  v_actor_name text;
  v_actor_role text;
  v_assignee_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_super(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and super admins may assign Booking Engine requests';
  END IF;

  SELECT * INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking Engine request not found'; END IF;

  IF _assigned_user_id IS NOT NULL THEN
    IF NOT public.is_staff(_assigned_user_id) THEN
      RAISE EXCEPTION 'The selected assignee is not an active staff account';
    END IF;
    SELECT full_name INTO v_assignee_name
    FROM public.profiles WHERE user_id = _assigned_user_id;
    IF v_assignee_name IS NULL THEN RAISE EXCEPTION 'Staff profile could not be found'; END IF;
  END IF;

  SELECT p.full_name, ur.role::text
    INTO v_actor_name, v_actor_role
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id = auth.uid()
    AND ur.role IN ('admin','super_admin')
  ORDER BY CASE WHEN ur.role::text = 'super_admin' THEN 0 ELSE 1 END
  LIMIT 1;

  UPDATE public.booking_engine_requests
  SET assigned_to = _assigned_user_id,
      assigned_at = CASE WHEN _assigned_user_id IS NULL THEN NULL ELSE now() END,
      updated_at = now()
  WHERE id = _request_id;

  INSERT INTO public.booking_engine_request_events(
    request_id,event_type,message,actor_user_id,actor_name,actor_role,metadata
  )
  VALUES (
    _request_id,
    'assignment_changed',
    CASE WHEN _assigned_user_id IS NULL THEN 'Request assignment cleared.'
      ELSE 'Request assigned to ' || v_assignee_name || '.' END,
    auth.uid(),
    COALESCE(v_actor_name,'Admin'),
    v_actor_role,
    jsonb_build_object('assigned_user_id',_assigned_user_id)
  );

  RETURN jsonb_build_object('request_id',_request_id,'assigned_to',_assigned_user_id,'assignee_name',v_assignee_name);
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_booking_engine_clarification(
  _request_id uuid,
  _response text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request public.booking_engine_requests%ROWTYPE;
  v_customer_name text;
  v_response text := NULLIF(btrim(_response), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF v_response IS NULL THEN RAISE EXCEPTION 'Enter your response before sending'; END IF;
  IF length(v_response) > 3000 THEN RAISE EXCEPTION 'Response must be 3000 characters or fewer'; END IF;

  SELECT * INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking Engine request not found'; END IF;

  IF v_request.customer_user_id IS DISTINCT FROM auth.uid()
     OR v_request.customer_id IS NULL
     OR NOT public.owns_client(v_request.customer_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not authorized to respond to this request';
  END IF;

  IF v_request.status <> 'awaiting_customer' THEN
    RAISE EXCEPTION 'This request is not waiting for a customer response';
  END IF;

  SELECT full_name INTO v_customer_name
  FROM public.profiles WHERE user_id = auth.uid();

  UPDATE public.booking_engine_requests
  SET status = 'under_review',
      updated_at = now()
  WHERE id = _request_id;

  INSERT INTO public.booking_engine_request_events(
    request_id,event_type,from_status,to_status,message,actor_user_id,actor_name,actor_role,metadata
  )
  VALUES (
    _request_id,'customer_response',v_request.status,'under_review',v_response,
    auth.uid(),COALESCE(v_customer_name,'Customer'),'customer',
    jsonb_build_object('source','customer_portal')
  );

  RETURN jsonb_build_object('request_id',_request_id,'status','under_review');
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_booking_engine_request(
  _request_id uuid,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request public.booking_engine_requests%ROWTYPE;
  v_customer_name text;
  v_reason text := NULLIF(btrim(_reason), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF v_reason IS NOT NULL AND length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'Cancellation reason must be 1000 characters or fewer';
  END IF;

  SELECT * INTO v_request
  FROM public.booking_engine_requests
  WHERE id = _request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking Engine request not found'; END IF;

  IF v_request.customer_user_id IS DISTINCT FROM auth.uid()
     OR v_request.customer_id IS NULL
     OR NOT public.owns_client(v_request.customer_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not authorized to cancel this request';
  END IF;

  IF v_request.status IN ('converted','rejected','cancelled') THEN
    RAISE EXCEPTION 'This request can no longer be cancelled';
  END IF;

  IF NOT public.booking_engine_is_valid_transition(v_request.status,'cancelled') THEN
    RAISE EXCEPTION 'This request is no longer eligible for cancellation';
  END IF;

  SELECT full_name INTO v_customer_name
  FROM public.profiles WHERE user_id = auth.uid();

  UPDATE public.booking_engine_requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = _request_id;

  INSERT INTO public.booking_engine_request_events(
    request_id,event_type,from_status,to_status,message,actor_user_id,actor_name,actor_role,metadata
  )
  VALUES (
    _request_id,'customer_cancelled',v_request.status,'cancelled',
    COALESCE(v_reason,'Customer cancelled the request.'),
    auth.uid(),COALESCE(v_customer_name,'Customer'),'customer',
    jsonb_build_object('source','customer_portal')
  );

  RETURN jsonb_build_object('request_id',_request_id,'status','cancelled');
END;
$function$;

REVOKE ALL ON FUNCTION public.transition_booking_engine_request_admin(uuid,public.booking_engine_request_status,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_booking_engine_request_admin(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_booking_engine_clarification(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_booking_engine_request(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_booking_engine_request_admin(uuid,public.booking_engine_request_status,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_booking_engine_request_admin(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_booking_engine_clarification(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_engine_request(uuid,text) TO authenticated;
