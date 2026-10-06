-- Allow the storage trigger to insert rows into public.assets
-- Run this in the Supabase SQL editor for your project.
-- WARNING: this policy is permissive (allows INSERTs from any DB role).
-- After verifying uploads work, tighten the policy to suit your security model.

-- Ensure RLS is enabled (if you prefer fully-managed access controls)
ALTER TABLE IF EXISTS public.assets ENABLE ROW LEVEL SECURITY;

-- Create a permissive INSERT policy so the trigger can upsert rows.
CREATE POLICY IF NOT EXISTS allow_storage_insert
  ON public.assets
  FOR INSERT
  USING (true)
  WITH CHECK (true);

-- If you'd rather disable RLS entirely on this table instead, run:
-- ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;

-- Recommended follow-up: replace the permissive policy with a stricter one that
-- validates the requester (e.g. checks a claim or only allows inserts from a
-- trusted DB role). I can help craft a stricter policy once you share
-- how you plan to authenticate trigger-originated actions.
