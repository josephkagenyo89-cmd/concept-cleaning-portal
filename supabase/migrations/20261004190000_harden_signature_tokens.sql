-- Harden client signature tokens.
-- Public clients must never query or update signature_tokens directly.
-- The public /sign flow uses Edge Functions with the service role.

DROP POLICY IF EXISTS "Anyone can view tokens by token value" ON public.signature_tokens;
DROP POLICY IF EXISTS "Anyone can mark tokens used" ON public.signature_tokens;
DROP POLICY IF EXISTS "Mark tokens as used" ON public.signature_tokens;
DROP POLICY IF EXISTS "Authenticated users can create tokens" ON public.signature_tokens;

CREATE POLICY "Admins can create signature tokens"
  ON public.signature_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND public.is_admin_or_super(auth.uid())
  );

-- Atomically consume a valid signature token and apply the client signature.
-- This prevents two concurrent submissions from both being accepted.
CREATE OR REPLACE FUNCTION public.apply_client_signature(
  p_token text,
  p_signature text,
  p_client_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
  v_staff_signature text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 OR length(p_token) > 256 THEN
    RAISE EXCEPTION 'Invalid signature token';
  END IF;

  IF p_signature IS NULL
     OR length(p_signature) > 2000000
     OR p_signature NOT LIKE 'data:image/%' THEN
    RAISE EXCEPTION 'Invalid signature format';
  END IF;

  IF p_client_name IS NULL OR length(trim(p_client_name)) = 0 OR length(p_client_name) > 200 THEN
    RAISE EXCEPTION 'Invalid client name';
  END IF;

  UPDATE public.signature_tokens
  SET used = true
  WHERE token = p_token
    AND used = false
    AND expires_at > now()
  RETURNING booking_id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Invalid, expired, or already used signature link';
  END IF;

  UPDATE public.bookings
  SET
    client_signature = p_signature,
    client_signed_at = now(),
    client_consent = true
  WHERE id = v_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT staff_signature
  INTO v_staff_signature
  FROM public.bookings
  WHERE id = v_booking_id;

  IF v_staff_signature IS NOT NULL THEN
    UPDATE public.bookings
    SET status = 'fully_confirmed'
    WHERE id = v_booking_id;
  END IF;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_client_signature(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_client_signature(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.apply_client_signature(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_client_signature(text, text, text) TO service_role;
