-- Allow unauthenticated visitors to read active service categories.
-- Marketplace and homepage booking category selectors are public-facing.
-- Keep RLS enabled and expose active category rows only to anon.

CREATE POLICY "Public can view active service categories"
ON public.service_categories
FOR SELECT
TO anon
USING (is_active = true);
