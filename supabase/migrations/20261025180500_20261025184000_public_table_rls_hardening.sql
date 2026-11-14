-- Restore row-level security on public-facing tables that currently bypass policies.
-- Review and apply only after validating the live application's lead-submission flow.

BEGIN;

-- Existing leads policies are intended to separate public lead creation from admin
-- viewing/updating. Enabling RLS makes those policies effective.
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Super admins need the same full lead-management access as admins. The existing
-- policy set includes super-admin deletion but omitted super-admin SELECT/UPDATE.
DROP POLICY IF EXISTS "Super admins full access to leads" ON public.leads;
CREATE POLICY "Super admins full access to leads"
  ON public.leads
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- public.assets is an internal mirror of Storage object metadata, not a client API.
-- The application uses Supabase Storage for file delivery; no client-side query of
-- public.assets was found. Deny direct anon/authenticated table access. Storage uploads
-- and public object reads are controlled by storage.buckets/storage.objects policies.
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.assets FROM anon, authenticated;

-- Deliberately create no anon/authenticated policies on public.assets. With RLS enabled,
-- direct access is denied; service_role and database owners retain administrative access.

COMMIT;
