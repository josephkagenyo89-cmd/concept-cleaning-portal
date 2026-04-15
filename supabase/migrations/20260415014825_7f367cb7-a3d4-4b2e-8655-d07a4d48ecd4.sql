
-- Drop overly permissive policy
DROP POLICY IF EXISTS "Anyone can mark tokens used" ON public.signature_tokens;

-- More restrictive: only allow setting used=true on unused, non-expired tokens
CREATE POLICY "Mark tokens as used"
  ON public.signature_tokens FOR UPDATE
  USING (used = false AND expires_at > now());

-- Allow anon to update bookings signature fields via edge function
-- We'll use an edge function with service role key instead
