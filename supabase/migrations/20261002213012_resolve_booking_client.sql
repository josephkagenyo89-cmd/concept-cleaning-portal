-- Resolve or create a CRM client for Book Service without leaving the module.
CREATE OR REPLACE FUNCTION public.resolve_booking_client(
  p_full_name text,
  p_phone text,
  p_location text,
  p_created_by_role text DEFAULT 'admin'
)
RETURNS TABLE (
  client_id uuid,
  client_code text,
  full_name text,
  phone text,
  location text,
  was_created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := NULLIF(trim(p_phone), '');
  v_name text := NULLIF(trim(p_full_name), '');
  v_location text := NULLIF(trim(p_location), '');
  v_client public.clients%ROWTYPE;
BEGIN
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Phone number is required to resolve a CRM client';
  END IF;

  SELECT c.*
    INTO v_client
  FROM public.clients c
  WHERE c.phone = v_phone
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT v_client.id, v_client.client_code, v_client.full_name,
           v_client.phone, v_client.location, false;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.clients (
      full_name,
      phone,
      location,
      created_by,
      created_by_role
    )
    VALUES (
      COALESCE(v_name, 'Unnamed Client'),
      v_phone,
      v_location,
      auth.uid(),
      COALESCE(NULLIF(trim(p_created_by_role), ''), 'admin')
    )
    RETURNING * INTO v_client;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT c.*
        INTO v_client
      FROM public.clients c
      WHERE c.phone = v_phone
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE;
      END IF;

      RETURN QUERY
      SELECT v_client.id, v_client.client_code, v_client.full_name,
             v_client.phone, v_client.location, false;
      RETURN;
  END;

  RETURN QUERY
  SELECT v_client.id, v_client.client_code, v_client.full_name,
         v_client.phone, v_client.location, true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_booking_client(text, text, text, text)
TO authenticated;