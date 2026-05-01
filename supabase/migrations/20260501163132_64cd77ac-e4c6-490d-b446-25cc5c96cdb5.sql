-- Client code sequence
CREATE SEQUENCE IF NOT EXISTS public.client_code_seq START 1;

-- Add client_code column
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_code text;

-- Backfill existing clients
DO $$
DECLARE
  r RECORD;
  n int;
BEGIN
  FOR r IN SELECT id FROM public.clients WHERE client_code IS NULL ORDER BY created_at LOOP
    n := nextval('public.client_code_seq');
    UPDATE public.clients SET client_code = 'CL-' || LPAD(n::text, 4, '0') WHERE id = r.id;
  END LOOP;
END $$;

-- Unique constraint on client_code
CREATE UNIQUE INDEX IF NOT EXISTS clients_client_code_unique ON public.clients(client_code);

-- Unique constraint on phone (prevent duplicates)
-- First, find and merge any duplicates by keeping the oldest
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT phone, MIN(created_at) AS keeper FROM public.clients GROUP BY phone HAVING COUNT(*) > 1 LOOP
    DELETE FROM public.clients WHERE phone = r.phone AND created_at <> r.keeper;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS clients_phone_unique ON public.clients(phone);

-- Function to generate next client code
CREATE OR REPLACE FUNCTION public.next_client_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'CL-' || LPAD(nextval('public.client_code_seq')::text, 4, '0')
$$;

-- Trigger to auto-assign client_code on insert
CREATE OR REPLACE FUNCTION public.assign_client_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_code IS NULL OR NEW.client_code = '' THEN
    NEW.client_code := public.next_client_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_client_code ON public.clients;
CREATE TRIGGER trg_assign_client_code
BEFORE INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.assign_client_code();