-- Restrict Smart Booking request assignees to admin and super-admin accounts.
-- Referral agents are not operational staff and must not be assigned service requests.

CREATE OR REPLACE FUNCTION public.assign_booking_engine_request_admin(
  _request_id uuid,
  _assigned_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking Engine request not found';
  END IF;

  IF _assigned_user_id IS NOT NULL THEN
    IF NOT public.is_admin_or_super(_assigned_user_id) THEN
      RAISE EXCEPTION 'The selected assignee must be an admin or super admin account';
    END IF;
    SELECT p.full_name INTO v_assignee_name
    FROM public.profiles p
    WHERE p.user_id = _assigned_user_id;
    IF v_assignee_name IS NULL THEN
      RAISE EXCEPTION 'Staff profile could not be found';
    END IF;
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

  RETURN jsonb_build_object(
    'request_id',_request_id,
    'assigned_to',_assigned_user_id,
    'assignee_name',v_assignee_name
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_booking_engine_request_admin(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_booking_engine_request_admin(uuid,uuid) TO authenticated;
ALTER FUNCTION public.assign_booking_engine_request_admin(uuid,uuid) SET search_path = '';
