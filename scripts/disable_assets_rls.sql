-- Disable Row Level Security for public.assets
-- Run this in the Supabase SQL editor to remove RLS restrictions on the assets table.
-- This will allow the storage trigger and clients to insert/update/delete rows without RLS checks.

ALTER TABLE IF EXISTS public.assets DISABLE ROW LEVEL SECURITY;

-- Verify state
SELECT relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'assets' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
