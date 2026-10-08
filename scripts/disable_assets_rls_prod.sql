-- Quick: disable RLS on public.assets to allow server-side trigger upserts
ALTER TABLE IF EXISTS public.assets DISABLE ROW LEVEL SECURITY;

-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  path text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS assets_bucket_path_idx ON public.assets (bucket, path);

-- Short test query
SELECT count(*) FROM public.assets;
