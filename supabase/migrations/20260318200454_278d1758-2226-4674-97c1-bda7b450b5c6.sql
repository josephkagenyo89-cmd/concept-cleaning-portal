
ALTER TABLE public.income_records
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS mpesa_code text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Unique constraint on mpesa_code (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS income_records_mpesa_code_unique ON public.income_records (mpesa_code) WHERE mpesa_code IS NOT NULL;

-- Mark all existing records as approved (backward compat)
UPDATE public.income_records SET status = 'approved' WHERE status = 'pending_approval';
