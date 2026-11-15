-- Restore row-level security on public-facing tables that currently bypass policies.
-- Review and apply only after validating the live application's lead-submission flow.

BEGIN;

-- Leads RLS and policies are intentionally left unchanged per project direction.

-- public.assets is an internal mirror of Storage object metadata, not a client API.
-- The application uses Supabase Storage for file delivery; no client-side query of
-- public.assets was found. Deny direct anon/authenticated table access. Storage uploads
-- and public object reads are controlled by storage.buckets/storage.objects policies.
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.assets FROM anon, authenticated;

-- Deliberately create no anon/authenticated policies on public.assets. With RLS enabled,
-- direct access is denied; service_role and database owners retain administrative access.

COMMIT;
